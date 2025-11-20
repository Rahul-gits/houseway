const express = require('express');
const router = express.Router();

const Invoice = require('../models/Invoice');
const Project = require('../models/Project');
const User = require('../models/User');

const { authenticate, requireRole, authorizeProjectAccess } = require('../middleware/auth');

/**
 * @route   GET /api/invoices
 * @desc    Get invoices with filtering and pagination
 * @access  Private (Employee, Owner)
 */
router.get('/', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = 'all',
      clientId = '',
      projectId = '',
      startDate = '',
      endDate = '',
      sortBy = 'issueDate',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Add status filter
    if (status !== 'all') {
      query.status = status;
    }

    // Add client filter
    if (clientId) {
      query.client = clientId;
    }

    // Add project filter
    if (projectId) {
      query.project = projectId;
    }

    // Add date range filter
    if (startDate || endDate) {
      query.issueDate = {};
      if (startDate) query.issueDate.$gte = new Date(startDate);
      if (endDate) query.issueDate.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const invoices = await Invoice.find(query)
      .populate('client', 'firstName lastName email')
      .populate('project', 'title')
      .populate('createdBy', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Invoice.countDocuments(query);

    // Calculate summary statistics
    const stats = await Invoice.getStats(
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    res.json({
      success: true,
      data: {
        invoices,
        stats: stats.reduce((acc, stat) => {
          acc[stat._id] = { count: stat.count, total: stat.totalAmount };
          return acc;
        }, {}),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoices',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoices/:id
 * @desc    Get invoice details
 * @access  Private
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findById(id)
      .populate('client', 'firstName lastName email phone address')
      .populate('project', 'title description timeline.expectedEndDate')
      .populate('createdBy', 'firstName lastName email');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check permissions (client can only view their own invoices)
    if (req.user.role === 'client' && invoice.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this invoice'
      });
    }

    res.json({
      success: true,
      data: {
        invoice
      }
    });
  } catch (error) {
    console.error('Get invoice details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoice details',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoices
 * @desc    Create invoice
 * @access  Private (Employee, Owner)
 */
router.post('/', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const {
      projectId,
      clientId,
      issueDate = new Date(),
      dueDate,
      items = [],
      tax = { rate: 0, amount: 0 },
      discount = 0,
      currency = 'USD',
      notes = '',
      paymentTerms = 'Net 30'
    } = req.body;

    // Validate project and client
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const client = await User.findOne({ _id: clientId, role: 'client' });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Validate that client belongs to the project
    if (project.client.toString() !== clientId) {
      return res.status(400).json({
        success: false,
        message: 'Client does not belong to this project'
      });
    }

    // Validate due date
    const dueDateObj = new Date(dueDate);
    if (dueDateObj <= new Date(issueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Due date must be after issue date'
      });
    }

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Create invoice
    const invoice = new Invoice({
      project: projectId,
      client: clientId,
      issueDate,
      dueDate: dueDateObj,
      items,
      tax,
      discount,
      currency,
      notes,
      paymentTerms,
      createdBy: req.user._id
    });

    await invoice.save();

    // Populate related information
    await invoice.populate([
      { path: 'client', select: 'firstName lastName email' },
      { path: 'project', select: 'title' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: {
        invoice
      }
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/invoices/:id
 * @desc    Update invoice
 * @access  Private (Creator or Owner)
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      issueDate,
      dueDate,
      items,
      tax,
      discount,
      currency,
      notes,
      paymentTerms
    } = req.body;

    // Find invoice
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check permissions
    if (invoice.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this invoice'
      });
    }

    // Don't allow updates to paid or cancelled invoices
    if (['paid', 'cancelled'].includes(invoice.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update paid or cancelled invoices'
      });
    }

    // Validate due date if provided
    if (dueDate && issueDate && new Date(dueDate) <= new Date(issueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Due date must be after issue date'
      });
    }

    // Update fields
    const allowedUpdates = ['issueDate', 'dueDate', 'items', 'tax', 'discount', 'currency', 'notes', 'paymentTerms'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('client', 'firstName lastName email')
      .populate('project', 'title')
      .populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: {
        invoice: updatedInvoice
      }
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/invoices/:id
 * @desc    Delete invoice
 * @access  Private (Creator or Owner)
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Find invoice
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Check permissions
    if (invoice.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this invoice'
      });
    }

    // Only allow deletion of draft invoices
    if (invoice.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete invoices that have been sent'
      });
    }

    await Invoice.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete invoice',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoices/:id/send
 * @desc    Send invoice to client
 * @access  Private (Employee, Owner)
 */
router.post('/:id/send', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findById(id)
      .populate('client', 'firstName lastName email')
      .populate('project', 'title');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft invoices can be sent'
      });
    }

    // Send invoice (changes status from draft to sent)
    await invoice.send();

    // TODO: Add email notification logic here
    // For now, just return success

    res.json({
      success: true,
      message: 'Invoice sent to client successfully',
      data: {
        invoice: {
          ...invoice.toObject(),
          status: 'sent'
        }
      }
    });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invoice',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoices/:id/mark-paid
 * @desc    Mark invoice as paid
 * @access  Private (Employee, Owner)
 */
router.post('/:id/mark-paid', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const { id } = req.params;
    const { paidAmount, paymentDate = new Date() } = req.body;

    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already marked as paid'
      });
    }

    await invoice.markAsPaid(paidAmount);

    res.json({
      success: true,
      message: 'Invoice marked as paid successfully',
      data: {
        invoice: {
          ...invoice.toObject(),
          status: 'paid',
          paidDate: invoice.paidDate,
          paidAmount: invoice.paidAmount
        }
      }
    });
  } catch (error) {
    console.error('Mark invoice as paid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark invoice as paid',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoices/overdue
 * @desc    Get overdue invoices
 * @access  Private (Employee, Owner)
 */
router.get('/overdue/list', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const overdueInvoices = await Invoice.findOverdue()
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments({
      status: 'sent',
      dueDate: { $lt: new Date() }
    });

    res.json({
      success: true,
      data: {
        invoices: overdueInvoices,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get overdue invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get overdue invoices',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoices/project/:projectId
 * @desc    Get invoices for a specific project
 * @access  Private
 */
router.get('/project/:projectId', authenticate, authorizeProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const query = { project: projectId };

    // Clients can only see sent invoices
    if (req.user.role === 'client') {
      query.status = { $in: ['sent', 'paid'] };
    }

    const invoices = await Invoice.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ issueDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get project invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get project invoices',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoices/client/:clientId
 * @desc    Get invoices for a specific client
 * @access  Private
 */
router.get('/client/:clientId', authenticate, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Check permissions
    if (req.user.role === 'client' && clientId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these invoices'
      });
    }

    const invoices = await Invoice.findByClient(clientId)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments({ client: clientId });

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get client invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get client invoices',
      error: error.message
    });
  }
});

module.exports = router;