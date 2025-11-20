const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const WorkStatus = require('../models/WorkStatus');
const Quotation = require('../models/Quotation');
const MaterialRequest = require('../models/MaterialRequest');

/**
 * @route   POST /api/work-status
 * @desc    Create a new work status update
 * @access  Private (Vendor only)
 */
router.post('/', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const { quotationId, materialRequestId, message, progress, attachments } = req.body;

    // Validate required fields
    if (!quotationId || !materialRequestId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Quotation ID, Material Request ID, and message are required',
      });
    }

    // Verify quotation exists and belongs to vendor
    const quotation = await Quotation.findById(quotationId);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found',
      });
    }

    if (quotation.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only create work status for your own quotations',
      });
    }

    // Verify quotation is approved
    if (quotation.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Work status can only be uploaded for approved quotations',
      });
    }

    // Create work status
    const workStatus = new WorkStatus({
      quotation: quotationId,
      materialRequest: materialRequestId,
      vendor: req.user._id,
      message: message.trim(),
      progress: progress || 0,
      attachments: attachments || [],
    });

    await workStatus.save();
    await workStatus.populate('vendor', 'firstName lastName');
    await workStatus.populate('attachments');

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('workStatusUpdated', {
        operation: 'created',
        workStatus: workStatus,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Work status created successfully',
      data: { workStatus },
    });
  } catch (error) {
    console.error('Create work status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create work status',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/work-status
 * @desc    Get work status updates (filtered by query params)
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { quotationId, materialRequestId, vendorId } = req.query;
    const query = {};

    if (quotationId) query.quotation = quotationId;
    if (materialRequestId) query.materialRequest = materialRequestId;
    if (vendorId) query.vendor = vendorId;

    // If vendor, only show their own updates
    if (req.user.role === 'vendor') {
      query.vendor = req.user._id;
    }

    const workStatuses = await WorkStatus.find(query)
      .populate('vendor', 'firstName lastName')
      .populate('attachments')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { workStatuses },
    });
  } catch (error) {
    console.error('Get work status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get work status updates',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/work-status/:id
 * @desc    Get a single work status update
 * @access  Private
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const workStatus = await WorkStatus.findById(req.params.id)
      .populate('vendor', 'firstName lastName')
      .populate('quotation')
      .populate('materialRequest')
      .populate('attachments');

    if (!workStatus) {
      return res.status(404).json({
        success: false,
        message: 'Work status not found',
      });
    }

    res.json({
      success: true,
      data: { workStatus },
    });
  } catch (error) {
    console.error('Get work status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get work status',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/work-status/:id
 * @desc    Update an existing work status update
 * @access  Private (Vendor only)
 */
router.put('/:id', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const { message, progress, attachments } = req.body;
    const { id } = req.params;

    // Find existing work status
    const workStatus = await WorkStatus.findById(id);
    
    if (!workStatus) {
      return res.status(404).json({
        success: false,
        message: 'Work status not found',
      });
    }

    // Verify work status belongs to vendor
    if (workStatus.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own work status updates',
      });
    }

    // Update fields
    if (message !== undefined) {
      workStatus.message = message.trim();
    }
    
    if (progress !== undefined) {
      workStatus.progress = Math.max(0, Math.min(100, progress)); // Ensure between 0-100
    }
    
    // For attachments, we want to keep all existing attachments and add new ones
    // This ensures images from previous updates are preserved
    if (attachments !== undefined && attachments.length > 0) {
      // Merge new attachments with existing ones, avoiding duplicates
      const existingAttachmentIds = workStatus.attachments.map(id => id.toString());
      const newAttachmentIds = attachments.filter(id => !existingAttachmentIds.includes(id));
      workStatus.attachments = [...workStatus.attachments, ...newAttachmentIds];
      
      // Log the new attachments that were added
      if (newAttachmentIds.length > 0) {
        console.log(`[WorkStatus] Added ${newAttachmentIds.length} new attachments to work status ${id}`);
      }
    }

    await workStatus.save();
    await workStatus.populate('vendor', 'firstName lastName');
    await workStatus.populate('attachments');

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('workStatusUpdated', {
        operation: 'updated',
        workStatus: workStatus,
      });
    }

    res.json({
      success: true,
      message: 'Work status updated successfully',
      data: { workStatus },
    });
  } catch (error) {
    console.error('Update work status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update work status',
      error: error.message,
    });
  }
});

module.exports = router;
