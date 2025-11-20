const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const PurchaseOrder = require('../models/PurchaseOrder');
const Quotation = require('../models/Quotation');
const Project = require('../models/Project');
const { authenticate, authorize, isOwner } = require('../middleware/auth');

/**
 * @route   GET /api/purchase-orders
 * @desc    Get purchase orders (role-based access)
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, projectId, vendorId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    let query = {};

    // Role-based filtering
    switch (req.user.role) {
      case 'owner':
        // Owner can see all purchase orders
        break;
      case 'vendor':
        // Vendor can see only their purchase orders
        query.vendor = req.user._id;
        break;
      case 'employee':
        // Employee can see purchase orders for projects they're assigned to
        const employeeProjects = await Project.find({ assignedEmployees: req.user._id }).select('_id');
        query.project = { $in: employeeProjects.map(p => p._id) };
        break;
      case 'client':
        // Client can see purchase orders for their projects
        const clientProjects = await Project.find({ client: req.user._id }).select('_id');
        query.project = { $in: clientProjects.map(p => p._id) };
        break;
      default:
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
    }

    // Additional filters
    if (status) query.status = status;
    if (projectId) query.project = projectId;
    if (vendorId) query.vendor = vendorId;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const purchaseOrders = await PurchaseOrder.find(query)
      .populate('quotation', 'quotationNumber title')
      .populate('materialRequest', 'title')
      .populate('project', 'title status')
      .populate('vendor', 'firstName lastName email vendorDetails.companyName')
      .populate('createdBy', 'firstName lastName')
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PurchaseOrder.countDocuments(query);

    res.json({
      success: true,
      data: {
        purchaseOrders,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get purchase orders',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/purchase-orders/:id
 * @desc    Get purchase order by ID
 * @access  Private (role-based)
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await PurchaseOrder.findById(id)
      .populate('quotation')
      .populate('materialRequest', 'title')
      .populate({
        path: 'project',
        select: 'title client assignedEmployees assignedVendors',
      })
      .populate('vendor', 'firstName lastName email vendorDetails')
      .populate('createdBy', 'firstName lastName')
      .populate('deliveries.receivedBy', 'firstName lastName')
      .populate('notes.author', 'firstName lastName');

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found',
      });
    }

    // Check access permissions
    const hasAccess =
      req.user.role === 'owner' ||
      (req.user.role === 'vendor' && purchaseOrder.vendor._id.toString() === req.user._id.toString()) ||
      (req.user.role === 'employee' && purchaseOrder.project.assignedEmployees.includes(req.user._id)) ||
      (req.user.role === 'client' && purchaseOrder.project.client.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view this purchase order.',
      });
    }

    res.json({
      success: true,
      data: { purchaseOrder },
    });
  } catch (error) {
    console.error('Get purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get purchase order',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/purchase-orders
 * @desc    Create purchase order from approved quotation
 * @access  Private (Owner only)
 */
router.post('/', authenticate, isOwner, async (req, res) => {
  try {
    const {
      quotationId,
      title,
      description,
      deliveryAddress,
      expectedDeliveryDate,
      paymentTerms,
    } = req.body;

    // Verify quotation exists and is approved
    const quotation = await Quotation.findById(quotationId)
      .populate('materialRequest', 'project');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    if (quotation.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved quotations can be converted to purchase orders',
      });
    }

    // Check if purchase order already exists for this quotation
    const existingPO = await PurchaseOrder.findOne({ quotation: quotationId });
    if (existingPO) {
      return res.status(400).json({
        success: false,
        message: 'Purchase order already exists for this quotation',
      });
    }

    // Create purchase order items from quotation items
    const items = quotation.items.map(item => ({
      quotationItem: item._id,
      materialName: item.materialName,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    const purchaseOrder = new PurchaseOrder({
      quotation: quotationId,
      materialRequest: quotation.materialRequest._id,
      project: quotation.materialRequest.project,
      vendor: quotation.vendor,
      title: title || `PO for ${quotation.title}`,
      description,
      items,
      subtotal: quotation.subtotal,
      tax: quotation.tax,
      discount: quotation.discount,
      deliveryCharges: quotation.deliveryTerms.deliveryCharges,
      deliveryAddress,
      expectedDeliveryDate,
      paymentTerms,
      createdBy: req.user._id,
    });

    await purchaseOrder.save();

    // Populate the created purchase order
    await purchaseOrder.populate('quotation materialRequest project vendor createdBy');

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: { purchaseOrder },
    });
  } catch (error) {
    console.error('Create purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create purchase order',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/purchase-orders/:id/send
 * @desc    Send purchase order to vendor
 * @access  Private (Owner only)
 */
router.put('/:id/send', authenticate, isOwner, async (req, res) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found',
      });
    }

    if (purchaseOrder.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft purchase orders can be sent',
      });
    }

    await purchaseOrder.send();
    await purchaseOrder.populate('vendor', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Purchase order sent successfully',
      data: { purchaseOrder },
    });
  } catch (error) {
    console.error('Send purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send purchase order',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/purchase-orders/:id/acknowledge
 * @desc    Acknowledge purchase order (vendor)
 * @access  Private (Vendor only - own POs)
 */
router.put('/:id/acknowledge', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found',
      });
    }

    // Check if vendor owns this purchase order
    if (purchaseOrder.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only acknowledge your own purchase orders',
      });
    }

    if (purchaseOrder.status !== 'sent') {
      return res.status(400).json({
        success: false,
        message: 'Only sent purchase orders can be acknowledged',
      });
    }

    await purchaseOrder.acknowledge();

    res.json({
      success: true,
      message: 'Purchase order acknowledged successfully',
      data: { purchaseOrder },
    });
  } catch (error) {
    console.error('Acknowledge purchase order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge purchase order',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/purchase-orders/:id/delivery
 * @desc    Record delivery for purchase order
 * @access  Private (Owner and Employee)
 */
router.post('/:id/delivery', authenticate, authorize('owner', 'employee'), async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryDate, items, deliveredBy, notes, attachments } = req.body;

    if (!deliveryDate || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Delivery date and items are required',
      });
    }

    const purchaseOrder = await PurchaseOrder.findById(id)
      .populate('project', 'assignedEmployees');

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found',
      });
    }

    // Check if employee is assigned to the project (if not owner)
    if (req.user.role === 'employee' && !purchaseOrder.project.assignedEmployees.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this project',
      });
    }

    const deliveryData = {
      deliveryDate: new Date(deliveryDate),
      items,
      deliveredBy,
      notes,
      attachments: attachments || [],
    };

    await purchaseOrder.recordDelivery(deliveryData, req.user._id);
    await purchaseOrder.populate('deliveries.receivedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Delivery recorded successfully',
      data: { purchaseOrder },
    });
  } catch (error) {
    console.error('Record delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record delivery',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/purchase-orders/project/:projectId
 * @desc    Get purchase orders for a specific project
 * @access  Private (role-based)
 */
router.get('/project/:projectId', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project exists and user has access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // Check access permissions
    const hasAccess =
      req.user.role === 'owner' ||
      (req.user.role === 'client' && project.client.toString() === req.user._id.toString()) ||
      (req.user.role === 'employee' && project.assignedEmployees.includes(req.user._id)) ||
      (req.user.role === 'vendor' && project.assignedVendors.includes(req.user._id));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const purchaseOrders = await PurchaseOrder.findByProject(projectId);

    res.json({
      success: true,
      data: { purchaseOrders },
    });
  } catch (error) {
    console.error('Get project purchase orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get project purchase orders',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/purchase-orders/vendor/my-orders
 * @desc    Get vendor's own purchase orders
 * @access  Private (Vendor only)
 */
router.get('/vendor/my-orders', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let query = { vendor: req.user._id };

    if (status) {
      query.status = status;
    }

    const purchaseOrders = await PurchaseOrder.find(query)
      .populate('project', 'title')
      .populate('materialRequest', 'title')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PurchaseOrder.countDocuments(query);

    res.json({
      success: true,
      data: {
        purchaseOrders,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get vendor purchase orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get vendor purchase orders',
      error: error.message,
    });
  }
});

module.exports = router;
