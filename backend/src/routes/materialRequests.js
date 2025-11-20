const express = require('express');
const router = express.Router();
const { validationResult } = require('express-validator');
const MaterialRequest = require('../models/MaterialRequest');
const Project = require('../models/Project');
const { authenticate, authorize, isOwner, isOwnerOrEmployee } = require('../middleware/auth');
const { validateMaterialRequest } = require('../middleware/validation');

/**
 * @route   GET /api/material-requests
 * @desc    Get material requests (role-based access)
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, projectId, sortBy = 'createdAt', sortOrder = 'desc', available } = req.query;

    let query = {};

    // Role-based filtering
    switch (req.user.role) {
      case 'owner':
        // Owner can see all material requests
        break;
      case 'employee':
        // Employee can see requests for projects they're assigned to
        const employeeProjects = await Project.find({ assignedEmployees: req.user._id }).select('_id');
        query.project = { $in: employeeProjects.map(p => p._id) };
        break;
      case 'vendor':
        // If 'available' flag is set, show unassigned/pending requests
        // Otherwise show only requests assigned to this vendor
        if (available === 'true') {
          query.$or = [
            { 'assignedVendors': { $size: 0 } }, // No vendors assigned
            { 'assignedVendors.vendor': { $ne: req.user._id } }, // Not assigned to this vendor
          ];
          query.status = { $in: ['pending', 'approved'] }; // Only show pending/approved
        } else {
          query['assignedVendors.vendor'] = req.user._id;
        }
        break;
      case 'client':
        // Client can see requests for their projects
        const clientProjects = await Project.find({ client: req.user._id }).select('_id');
        query.project = { $in: clientProjects.map(p => p._id) };
        break;
      default:
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
    }

    // Filter by status if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by project if provided
    if (projectId) {
      query.project = projectId;
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const materialRequests = await MaterialRequest.find(query)
      .populate('project', 'title status')
      .populate('requestedBy', 'firstName lastName email')
      .populate('assignedVendors.vendor', 'firstName lastName email vendorDetails.companyName')
      .populate('assignedVendors.assignedBy', 'firstName lastName')
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await MaterialRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        materialRequests,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error('Get material requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get material requests',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/material-requests/:id
 * @desc    Get material request by ID
 * @access  Private (role-based)
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const materialRequest = await MaterialRequest.findById(id)
      .populate('project', 'title status client assignedEmployees assignedVendors')
      .populate('requestedBy', 'firstName lastName email')
      .populate('assignedVendors.vendor', 'firstName lastName email vendorDetails')
      .populate('assignedVendors.assignedBy', 'firstName lastName')
      .populate('approvals.approvedBy', 'firstName lastName')
      .populate('notes.author', 'firstName lastName');

    if (!materialRequest) {
      return res.status(404).json({
        success: false,
        message: 'Material request not found',
      });
    }

    // Check access permissions
    const hasAccess =
      req.user.role === 'owner' ||
      (req.user.role === 'employee' && materialRequest.project.assignedEmployees.includes(req.user._id)) ||
      (req.user.role === 'vendor' && materialRequest.assignedVendors.some(av => av.vendor._id.toString() === req.user._id.toString())) ||
      (req.user.role === 'client' && materialRequest.project.client.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view this material request.',
      });
    }

    res.json({
      success: true,
      data: { materialRequest },
    });
  } catch (error) {
    console.error('Get material request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get material request',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/material-requests
 * @desc    Create new material request
 * @access  Private (Owner and Employee only)
 */
router.post('/', authenticate, isOwnerOrEmployee, validateMaterialRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const {
      projectId,
      title,
      description,
      materials,
      priority,
      requiredBy,
    } = req.body;

    // Verify project exists and user has access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    // Check if employee is assigned to the project (if not owner)
    if (req.user.role === 'employee' && !project.assignedEmployees.includes(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this project',
      });
    }

    const materialRequest = new MaterialRequest({
      project: projectId,
      requestedBy: req.user._id,
      title,
      description,
      materials,
      priority,
      requiredBy,
    });

    await materialRequest.save();

    // Populate the created material request
    await materialRequest.populate('project requestedBy');

    // Emit socket event for new creation
    const io = req.app.get('io');
    if (io) io.emit('materialRequest', { operation: 'created', materialRequest });

    res.status(201).json({
      success: true,
      message: 'Material request created successfully',
      data: { materialRequest },
    });
  } catch (error) {
    console.error('Create material request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create material request',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/material-requests/:id/approve
 * @desc    Approve material request
 * @access  Private (Owner only)
 */
router.put('/:id/approve', authenticate, isOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { comments = '' } = req.body;

    const materialRequest = await MaterialRequest.findById(id);
    if (!materialRequest) {
      return res.status(404).json({
        success: false,
        message: 'Material request not found',
      });
    }

    if (materialRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending requests can be approved',
      });
    }

    await materialRequest.approve(req.user._id, comments);
    await materialRequest.populate('project requestedBy approvals.approvedBy');

    // Emit socket event for approval
    const io = req.app.get('io');
    if (io) io.emit('materialRequest', { operation: 'approved', materialRequest });

    res.json({
      success: true,
      message: 'Material request approved successfully',
      data: { materialRequest },
    });
  } catch (error) {
    console.error('Approve material request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve material request',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/material-requests/:id/reject
 * @desc    Reject material request
 * @access  Private (Owner only)
 */
router.put('/:id/reject', authenticate, isOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { comments = '' } = req.body;

    const materialRequest = await MaterialRequest.findById(id);
    if (!materialRequest) {
      return res.status(404).json({
        success: false,
        message: 'Material request not found',
      });
    }

    if (materialRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending requests can be rejected',
      });
    }

    await materialRequest.reject(req.user._id, comments);
    await materialRequest.populate('project requestedBy approvals.approvedBy');

    // Emit socket event for rejection
    const io = req.app.get('io');
    if (io) io.emit('materialRequest', { operation: 'rejected', materialRequest });

    res.json({
      success: true,
      message: 'Material request rejected successfully',
      data: { materialRequest },
    });
  } catch (error) {
    console.error('Reject material request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject material request',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/material-requests/:id/accept
 * @desc    Vendor accepts material request (self-assign)
 * @access  Private (Vendor only)
 */
router.post('/:id/accept', authenticate, authorize('vendor'), async (req, res) => {
  try {
    const { id } = req.params;

    const materialRequest = await MaterialRequest.findById(id)
      .populate('project', 'title status');

    if (!materialRequest) {
      return res.status(404).json({
        success: false,
        message: 'Material request not found',
      });
    }

    // Check if request is in valid status
    if (!['pending', 'approved'].includes(materialRequest.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only pending or approved requests can be accepted',
      });
    }

    // Check if vendor is already assigned
    const isAlreadyAssigned = materialRequest.assignedVendors.some(
      av => av.vendor.toString() === req.user._id.toString()
    );

    if (isAlreadyAssigned) {
      return res.status(400).json({
        success: false,
        message: 'You have already accepted this material request',
      });
    }

    // Assign vendor (self-assign)
    materialRequest.assignedVendors.push({
      vendor: req.user._id,
      assignedAt: new Date(),
      assignedBy: req.user._id, // Self-assigned
    });

    await materialRequest.save();
    await materialRequest.populate('assignedVendors.vendor', 'firstName lastName email vendorDetails.companyName');

    // Emit socket event for vendor acceptance
    const io = req.app.get('io');
    if (io) io.emit('materialRequest', { operation: 'vendorAccepted', materialRequest });

    res.json({
      success: true,
      message: 'Material request accepted successfully. You can now create a quotation.',
      data: { materialRequest },
    });
  } catch (error) {
    console.error('Accept material request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept material request',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/material-requests/:id/assign-vendor
 * @desc    Assign vendor to material request
 * @access  Private (Owner only)
 */
router.put('/:id/assign-vendor', authenticate, isOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId } = req.body;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID is required',
      });
    }

    const materialRequest = await MaterialRequest.findById(id);
    if (!materialRequest) {
      return res.status(404).json({
        success: false,
        message: 'Material request not found',
      });
    }

    await materialRequest.assignVendor(vendorId, req.user._id);
    await materialRequest.populate('assignedVendors.vendor assignedVendors.assignedBy');

    // Emit socket event for vendor assignment
    const io = req.app.get('io');
    if (io) io.emit('materialRequest', { operation: 'vendorAssigned', materialRequest });

    res.json({
      success: true,
      message: 'Vendor assigned successfully',
      data: { materialRequest },
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
 * @route   POST /api/material-requests/:id/notes
 * @desc    Add note to material request
 * @access  Private (Owner, Employee, Vendor with access)
 */
router.post('/:id/notes', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Note content is required',
      });
    }

    const materialRequest = await MaterialRequest.findById(id)
      .populate('project', 'assignedEmployees assignedVendors client');

    if (!materialRequest) {
      return res.status(404).json({
        success: false,
        message: 'Material request not found',
      });
    }

    // Check access permissions
    const hasAccess =
      req.user.role === 'owner' ||
      (req.user.role === 'employee' && materialRequest.project.assignedEmployees.includes(req.user._id)) ||
      (req.user.role === 'vendor' && materialRequest.assignedVendors.some(av => av.vendor.toString() === req.user._id.toString())) ||
      (req.user.role === 'client' && materialRequest.project.client.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await materialRequest.addNote(content.trim(), req.user._id);
    await materialRequest.populate('notes.author', 'firstName lastName');

    res.json({
      success: true,
      message: 'Note added successfully',
      data: { materialRequest },
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/material-requests/project/:projectId
 * @desc    Get material requests for a specific project
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

    const materialRequests = await MaterialRequest.findByProject(projectId);

    res.json({
      success: true,
      data: { materialRequests },
    });
  } catch (error) {
    console.error('Get project material requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get project material requests',
      error: error.message,
    });
  }
});

module.exports = router;
