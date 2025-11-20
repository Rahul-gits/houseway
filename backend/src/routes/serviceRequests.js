const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const { authenticate, authorize, isOwner } = require('../middleware/auth');
const { uploadMultiple, getFileUrl } = require('../middleware/upload');

/**
 * @route   GET /api/service-requests
 * @desc    Get service requests (role-based access)
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, requestType, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    let filters = {};
    if (status) filters.status = status;
    if (requestType) filters.requestType = requestType;

    const requests = await ServiceRequest.getByUserRole(req.user, filters)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 });

    const total = await ServiceRequest.countDocuments(filters);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get service requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get service requests',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/service-requests
 * @desc    Create new service request
 * @access  Private
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      requestType,
      title,
      description,
      priority = 'medium',
      budget,
      timeline,
      requirements,
    } = req.body;

    const serviceRequest = new ServiceRequest({
      requestType,
      title,
      description,
      requestedBy: req.user._id,
      priority,
      budget,
      timeline,
      requirements,
    });

    await serviceRequest.save();

    // Populate the created request
    await serviceRequest.populate('requestedBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      data: { request: serviceRequest },
    });
  } catch (error) {
    console.error('Create service request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service request',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/service-requests/:id
 * @desc    Get service request by ID
 * @access  Private (role-based)
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ServiceRequest.findById(id)
      .populate('requestedBy', 'firstName lastName email')
      .populate('assignedVendor', 'firstName lastName email vendorDetails')
      .populate('communication.sender', 'firstName lastName')
      .populate('attachments.uploadedBy', 'firstName lastName')
      .populate('deliverables.uploadedBy', 'firstName lastName');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found',
      });
    }

    // Check access permissions
    const hasAccess =
      req.user.role === 'owner' ||
      request.requestedBy._id.toString() === req.user._id.toString() ||
      (request.assignedVendor && request.assignedVendor._id.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: { request },
    });
  } catch (error) {
    console.error('Get service request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get service request',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/service-requests/:id/assign
 * @desc    Assign vendor to service request
 * @access  Private (Owner only)
 */
router.put('/:id/assign', authenticate, isOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId } = req.body;

    // Verify vendor exists and has vendor role
    const vendor = await User.findById(vendorId);
    if (!vendor || vendor.role !== 'vendor') {
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID or user is not a vendor',
      });
    }

    const request = await ServiceRequest.findById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found',
      });
    }

    request.assignedVendor = vendorId;
    await request.updateStatus('assigned', req.user._id);

    await request.populate('assignedVendor', 'firstName lastName email vendorDetails');

    res.json({
      success: true,
      message: 'Vendor assigned successfully',
      data: { request },
    });
  } catch (error) {
    console.error('Assign vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign vendor',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/service-requests/:id/status
 * @desc    Update service request status
 * @access  Private (Owner, assigned vendor, or requester)
 */
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const request = await ServiceRequest.findById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found',
      });
    }

    // Check permissions
    const hasAccess =
      req.user.role === 'owner' ||
      request.requestedBy.toString() === req.user._id.toString() ||
      (request.assignedVendor && request.assignedVendor.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await request.updateStatus(status, req.user._id);

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: { request },
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/service-requests/:id/communication
 * @desc    Add communication to service request
 * @access  Private (Owner, assigned vendor, or requester)
 */
router.post('/:id/communication', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { message, isInternal = false } = req.body;

    const request = await ServiceRequest.findById(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found',
      });
    }

    // Check permissions
    const hasAccess =
      req.user.role === 'owner' ||
      request.requestedBy.toString() === req.user._id.toString() ||
      (request.assignedVendor && request.assignedVendor.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await request.addCommunication(message, req.user._id, isInternal);

    res.json({
      success: true,
      message: 'Communication added successfully',
      data: { request },
    });
  } catch (error) {
    console.error('Add communication error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add communication',
      error: error.message,
    });
  }
});

module.exports = router;
