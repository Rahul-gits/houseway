const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const Quotation = require('../models/Quotation');
const MaterialRequest = require('../models/MaterialRequest');
const { authenticate, authorize, isOwner } = require('../middleware/auth');
const { uploadMultiple, getFileUrl } = require('../middleware/upload');

/**
 * @route   GET /api/quotations
 * @desc    Get quotations (role-based access)
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, materialRequestId, materialRequestIds, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    let query = {};

    // Role-based filtering
    switch (req.user.role) {
      case 'owner':
        // Owner can see all quotations
        break;
      case 'vendor':
        // Vendor can see only their quotations
        query.vendor = req.user._id;
        break;
      case 'employee':
      case 'client':
        // Employees and clients can see quotations for their projects
        const materialRequests = await MaterialRequest.find()
          .populate('project', 'assignedEmployees client')
          .select('_id project');

        const accessibleMRIds = materialRequests.filter(mr => {
          if (req.user.role === 'employee') {
            return mr.project.assignedEmployees.includes(req.user._id);
          } else if (req.user.role === 'client') {
            return mr.project.client.toString() === req.user._id.toString();
          }
          return false;
        }).map(mr => mr._id);

        query.materialRequest = { $in: accessibleMRIds };
        break;
      default:
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
    }

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    // Filter by single material request ID if provided
    if (materialRequestId) {
      query.materialRequest = materialRequestId;
    }

    // Filter by multiple material request IDs if provided
    if (materialRequestIds) {
      const ids = materialRequestIds.split(',').map(id => id.trim()).filter(id => id);
      if (ids.length > 0) {
        // If we already have a materialRequest filter, combine them
        if (query.materialRequest) {
          // Convert to array if it's not already
          const existingIds = Array.isArray(query.materialRequest) ? query.materialRequest : [query.materialRequest];
          query.materialRequest = { $in: [...existingIds, ...ids] };
        } else {
          query.materialRequest = { $in: ids };
        }
      }
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const quotations = await Quotation.find(query)
      .populate('materialRequest', 'title project')
      .populate('vendor', 'firstName lastName email vendorDetails.companyName')
      .populate('reviews.reviewedBy', 'firstName lastName')
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Quotation.countDocuments(query);

    res.json({
      success: true,
      data: {
        quotations,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get quotations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get quotations',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/quotations/:id
 * @desc    Get quotation by ID
 * @access  Private (role-based)
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const quotation = await Quotation.findById(id)
      .populate({
        path: 'materialRequest',
        populate: {
          path: 'project',
          select: 'title client assignedEmployees assignedVendors',
        },
      })
      .populate('vendor', 'firstName lastName email vendorDetails')
      .populate('reviews.reviewedBy', 'firstName lastName')
      .populate('notes.author', 'firstName lastName');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    // Check access permissions
    const hasAccess =
      req.user.role === 'owner' ||
      (req.user.role === 'vendor' && quotation.vendor._id.toString() === req.user._id.toString()) ||
      (req.user.role === 'employee' && quotation.materialRequest.project.assignedEmployees.includes(req.user._id)) ||
      (req.user.role === 'client' && quotation.materialRequest.project.client.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view this quotation.',
      });
    }

    res.json({
      success: true,
      data: { quotation },
    });
  } catch (error) {
    console.error('Get quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get quotation',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/quotations
 * @desc    Create new quotation
 * @access  Private (Vendor only)
 */
router.post('/', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const {
      materialRequestId,
      title,
      description,
      items,
      tax,
      discount,
      validUntil,
      deliveryTerms,
      paymentTerms,
    } = req.body;

    // Verify material request exists and vendor is assigned
    const materialRequest = await MaterialRequest.findById(materialRequestId);
    if (!materialRequest) {
      return res.status(404).json({
        success: false,
        message: 'Material request not found',
      });
    }

    // Check if vendor is assigned to this material request
    const isAssigned = materialRequest.assignedVendors.some(
      av => av.vendor.toString() === req.user._id.toString()
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this material request',
      });
    }

    const quotation = new Quotation({
      materialRequest: materialRequestId,
      vendor: req.user._id,
      title,
      description,
      items,
      tax,
      discount,
      validUntil,
      deliveryTerms,
      paymentTerms,
    });

    await quotation.save();

    // Populate the created quotation
    await quotation.populate('materialRequest vendor');

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: { quotation },
    });
  } catch (error) {
    console.error('Create quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create quotation',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/quotations/:id/submit
 * @desc    Submit quotation for review
 * @access  Private (Vendor only - own quotations)
 */
router.put('/:id/submit', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const { id } = req.params;

    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    // Check if vendor owns this quotation
    if (quotation.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only submit your own quotations',
      });
    }

    if (quotation.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft quotations can be submitted',
      });
    }

    await quotation.submit();
    await quotation.populate('materialRequest vendor');

    res.json({
      success: true,
      message: 'Quotation submitted successfully',
      data: { quotation },
    });
  } catch (error) {
    console.error('Submit quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit quotation',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/quotations/:id/approve
 * @desc    Approve quotation
 * @access  Private (Owner only)
 */
router.put('/:id/approve', authenticate, isOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { comments = '', rating } = req.body;

    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    if (quotation.status !== 'submitted' && quotation.status !== 'under_review') {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or under review quotations can be approved',
      });
    }

    await quotation.approve(req.user._id, comments, rating);
    await quotation.populate('materialRequest vendor reviews.reviewedBy');

    res.json({
      success: true,
      message: 'Quotation approved successfully',
      data: { quotation },
    });
  } catch (error) {
    console.error('Approve quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve quotation',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/quotations/:id/reject
 * @desc    Reject quotation
 * @access  Private (Owner only)
 */
router.put('/:id/reject', authenticate, isOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { comments = '' } = req.body;

    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    if (quotation.status !== 'submitted' && quotation.status !== 'under_review') {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or under review quotations can be rejected',
      });
    }

    await quotation.reject(req.user._id, comments);
    await quotation.populate('materialRequest vendor reviews.reviewedBy');

    res.json({
      success: true,
      message: 'Quotation rejected successfully',
      data: { quotation },
    });
  } catch (error) {
    console.error('Reject quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject quotation',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/quotations/material-request/:materialRequestId
 * @desc    Get quotations for a specific material request
 * @access  Private (role-based)
 */
router.get('/material-request/:materialRequestId', authenticate, async (req, res) => {
  try {
    const { materialRequestId } = req.params;

    // Verify material request exists and user has access
    const materialRequest = await MaterialRequest.findById(materialRequestId)
      .populate('project', 'client assignedEmployees assignedVendors');

    if (!materialRequest) {
      return res.status(404).json({
        success: false,
        message: 'Material request not found',
      });
    }

    // Check access permissions
    const hasAccess =
      req.user.role === 'owner' ||
      (req.user.role === 'client' && materialRequest.project.client.toString() === req.user._id.toString()) ||
      (req.user.role === 'employee' && materialRequest.project.assignedEmployees.includes(req.user._id)) ||
      (req.user.role === 'vendor' && materialRequest.assignedVendors.some(av => av.vendor.toString() === req.user._id.toString()));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const quotations = await Quotation.findByMaterialRequest(materialRequestId);

    res.json({
      success: true,
      data: { quotations },
    });
  } catch (error) {
    console.error('Get material request quotations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get material request quotations',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/quotations/vendor/my-quotations
 * @desc    Get vendor's own quotations
 * @access  Private (Vendor only)
 */
router.get('/vendor/my-quotations', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = { vendor: req.user._id };

    if (status) {
      query.status = status;
    }

    const quotations = await Quotation.find(query)
      .populate('materialRequest', 'title project')
      .populate('reviews.reviewedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Quotation.countDocuments(query);

    res.json({
      success: true,
      data: {
        quotations,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get vendor quotations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get vendor quotations',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/quotations/:id/upload-attachments
 * @desc    Upload attachments to quotation
 * @access  Private (Vendor only - own quotations)
 */
router.post('/:id/upload-attachments', authenticate, authorize('vendor'), uploadMultiple('attachments', 3), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    // Check if vendor owns this quotation
    if (quotation.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only upload attachments to your own quotations',
      });
    }

    // Add attachments to quotation
    const attachments = req.files.map(file => {
      let type = 'other';
      if (file.mimetype === 'application/pdf') {
        type = 'pdf';
      } else if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet')) {
        type = 'excel';
      } else if (file.mimetype.startsWith('image/')) {
        type = 'image';
      }

      return {
        name: file.originalname,
        url: getFileUrl(req, `quotations/${file.filename}`),
        type,
      };
    });

    quotation.attachments.push(...attachments);
    await quotation.save();

    res.json({
      success: true,
      message: 'Attachments uploaded successfully',
      data: { attachments },
    });
  } catch (error) {
    console.error('Upload quotation attachments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload attachments',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/quotations/pending-review
 * @desc    Get quotations pending review (Owner only)
 * @access  Private (Owner only)
 */
router.get('/pending-review', authenticate, isOwner, async (req, res) => {
  try {
    const quotations = await Quotation.findPending();

    res.json({
      success: true,
      data: { quotations },
    });
  } catch (error) {
    console.error('Get pending quotations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending quotations',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/quotations/:id/status
 * @desc    Update quotation status (Owner only)
 * @access  Private (Owner only)
 */
router.put('/:id/status', authenticate, isOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comments = '' } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const validStatuses = ['under_review', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: under_review, approved, rejected',
      });
    }

    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    if (status === 'approved') {
      await quotation.approve(req.user._id, comments);
    } else if (status === 'rejected') {
      await quotation.reject(req.user._id, comments);
    } else {
      quotation.status = status;
      await quotation.save();
    }

    await quotation.populate('reviews.reviewedBy', 'firstName lastName');

    res.json({
      success: true,
      message: `Quotation ${status} successfully`,
      data: { quotation },
    });
  } catch (error) {
    console.error('Update quotation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quotation status',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/quotations/:id/notes
 * @desc    Add a note/message to quotation (for negotiation chat)
 * @access  Private (Vendor, Client, Employee, Owner)
 */
router.post('/:id/notes', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note content is required',
      });
    }

    const quotation = await Quotation.findById(id)
      .populate('materialRequest', 'project')
      .populate('vendor', 'firstName lastName');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    // Add note to quotation
    quotation.notes.push({
      author: req.user._id,
      content: content.trim(),
      isInternal: false,
    });

    await quotation.save();
    await quotation.populate('notes.author', 'firstName lastName role');

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('quotationUpdated', {
        operation: 'noteAdded',
        quotation: quotation,
      });
    }

    res.json({
      success: true,
      message: 'Note added successfully',
      data: { 
        quotation,
        note: quotation.notes[quotation.notes.length - 1]
      },
    });
  } catch (error) {
    console.error('Add quotation note error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/quotations/:id
 * @desc    Update quotation (for revising during negotiation)
 * @access  Private (Vendor only - own quotations)
 */
router.put('/:id', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { items, deliveryTerms, paymentTerms, notes } = req.body;

    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    // Check if vendor owns this quotation
    if (quotation.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own quotations',
      });
    }

    // Prevent updating approved quotations
    if (quotation.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Approved quotations cannot be modified',
      });
    }

    // Update fields if provided
    if (items) quotation.items = items;
    if (deliveryTerms) quotation.deliveryTerms = { ...quotation.deliveryTerms, ...deliveryTerms };
    if (paymentTerms) quotation.paymentTerms = { ...quotation.paymentTerms, ...paymentTerms };
    if (notes) {
      quotation.notes.push({
        author: req.user._id,
        content: `Updated quotation: ${notes}`,
        isInternal: false,
      });
    }

    await quotation.save();
    await quotation.populate('materialRequest vendor notes.author');

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('quotationUpdated', {
        operation: 'updated',
        quotation: quotation,
      });
    }

    res.json({
      success: true,
      message: 'Quotation updated successfully',
      data: { quotation },
    });
  } catch (error) {
    console.error('Update quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quotation',
      error: error.message,
    });
  }
});

module.exports = router;
