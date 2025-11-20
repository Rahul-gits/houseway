const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Project = require('../models/Project');
const TimelineEvent = require('../models/TimelineEvent');
const Media = require('../models/Media');
const Invoice = require('../models/Invoice');

const { authenticate, requireRole } = require('../middleware/auth');

/**
 * @route   GET /api/clients
 * @desc    Get all clients with filtering and pagination
 * @access  Private (Employee, Owner)
 */
router.get('/', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = 'all',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { role: 'client', isActive: true };

    // Add status filtering based on project status
    if (status !== 'all') {
      const statusMap = {
        'active': 'in-progress',
        'pending': 'planning',
        'completed': 'completed',
        'at-risk': 'on-hold'
      };

      if (statusMap[status]) {
        query['projectStatus'] = statusMap[status];
      }
    }

    // Add search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get clients with their project information
    const clients = await User.find(query)
      .populate({
        path: 'clientProjects',
        match: { status: { $ne: 'cancelled' } },
        select: 'title status progress.percentage timeline.expectedEndDate'
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await User.countDocuments(query);

    // Add project status information to each client
    const clientsWithStatus = clients.map(client => {
      const clientObj = client.toSafeObject();

      if (client.clientProjects && client.clientProjects.length > 0) {
        const latestProject = client.clientProjects[0];
        clientObj.projectStatus = latestProject.status;
        clientObj.projectProgress = latestProject.progress.percentage;
        clientObj.projectDeadline = latestProject.timeline.expectedEndDate;
      } else {
        clientObj.projectStatus = 'no-projects';
        clientObj.projectProgress = 0;
      }

      delete clientObj.clientProjects;
      return clientObj;
    });

    res.json({
      success: true,
      data: {
        clients: clientsWithStatus,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get clients',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/clients/:id
 * @desc    Get client profile with projects and statistics
 * @access  Private (Employee, Owner)
 */
router.get('/:id', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const { id } = req.params;

    // Get client details
    const client = await User.findOne({ _id: id, role: 'client', isActive: true })
      .populate('createdBy', 'firstName lastName');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Get client's projects
    const projects = await Project.find({
      client: id,
      status: { $ne: 'cancelled' }
    })
      .populate('assignedEmployees', 'firstName lastName')
      .populate('assignedVendors', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Calculate statistics
    const stats = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'in-progress').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      totalBudget: projects.reduce((sum, p) => sum + (p.budget.estimated || 0), 0),
      averageProgress: projects.length > 0
        ? Math.round(projects.reduce((sum, p) => sum + p.progress.percentage, 0) / projects.length)
        : 0
    };

    // Get recent timeline events
    const recentEvents = await TimelineEvent.find({
      project: { $in: projects.map(p => p._id) },
      visibility: 'public'
    })
      .populate('author', 'firstName lastName')
      .sort({ eventDate: -1 })
      .limit(5);

    // Get recent media
    const recentMedia = await Media.find({
      project: { $in: projects.map(p => p._id) },
      featured: true
    })
      .populate('uploadedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(6);

    res.json({
      success: true,
      data: {
        client: client.toSafeObject(),
        projects,
        stats,
        recentEvents,
        recentMedia
      }
    });
  } catch (error) {
    console.error('Get client profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get client profile',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/clients/:id/projects
 * @desc    Get client's projects with detailed information
 * @access  Private (Employee, Owner)
 */
router.get('/:id/projects', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 'all' } = req.query;

    // Build query
    const query = { client: id };
    if (status !== 'all') {
      query.status = status;
    }

    const projects = await Project.find(query)
      .populate('assignedEmployees', 'firstName lastName profileImage')
      .populate('assignedVendors', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Add additional project statistics
    const projectsWithStats = projects.map(project => {
      const projectObj = project.toObject();

      // Calculate days remaining
      if (project.timeline.expectedEndDate && project.status !== 'completed') {
        const diffTime = project.timeline.expectedEndDate - new Date();
        projectObj.daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      // Budget utilization
      if (project.budget.estimated && project.budget.actual) {
        projectObj.budgetUtilization = Math.round((project.budget.actual / project.budget.estimated) * 100);
      }

      return projectObj;
    });

    res.json({
      success: true,
      data: {
        projects: projectsWithStats
      }
    });
  } catch (error) {
    console.error('Get client projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get client projects',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/clients/:id/timeline
 * @desc    Add timeline event for client's project
 * @access  Private (Employee, Owner)
 */
router.post('/:id/timeline', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      projectId,
      eventType,
      title,
      description,
      visibility = 'public',
      tags = [],
      eventDate = new Date(),
      metadata = {}
    } = req.body;

    // Validate that the project belongs to the client
    const project = await Project.findOne({ _id: projectId, client: id });
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or does not belong to this client'
      });
    }

    // Create timeline event
    const timelineEvent = new TimelineEvent({
      project: projectId,
      eventType,
      title,
      description,
      author: req.user._id,
      visibility,
      tags,
      eventDate,
      metadata
    });

    await timelineEvent.save();

    // Populate author information
    await timelineEvent.populate('author', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Timeline event created successfully',
      data: {
        timelineEvent
      }
    });
  } catch (error) {
    console.error('Create timeline event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create timeline event',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/clients/:id/media
 * @desc    Get client's media across all projects
 * @access  Private (Employee, Owner)
 */
router.get('/:id/media', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category = 'all',
      page = 1,
      limit = 20
    } = req.query;

    // Get client's projects
    const projects = await Project.find({ client: id }).select('_id');
    const projectIds = projects.map(p => p._id);

    // Build query
    const query = { project: { $in: projectIds } };
    if (category !== 'all') {
      query.category = category;
    }

    // Pagination
    const skip = (page - 1) * limit;

    const media = await Media.find(query)
      .populate('uploadedBy', 'firstName lastName')
      .populate('project', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Media.countDocuments(query);

    res.json({
      success: true,
      data: {
        media,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get client media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get client media',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/clients/:id/invoices
 * @desc    Create invoice for client
 * @access  Private (Employee, Owner)
 */
router.post('/:id/invoices', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      projectId,
      issueDate = new Date(),
      dueDate,
      items = [],
      tax = { rate: 0, amount: 0 },
      discount = 0,
      currency = 'USD',
      notes = '',
      paymentTerms = 'Net 30'
    } = req.body;

    // Validate that the project belongs to the client
    const project = await Project.findOne({ _id: projectId, client: id });
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or does not belong to this client'
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

    // Create invoice
    const invoice = new Invoice({
      project: projectId,
      client: id,
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
 * @route   GET /api/clients/:id/statistics
 * @desc    Get comprehensive statistics for a client
 * @access  Private (Employee, Owner)
 */
router.get('/:id/statistics', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const { id } = req.params;

    // Get client's projects
    const projects = await Project.find({ client: id });

    // Project statistics
    const projectStats = {
      total: projects.length,
      planning: projects.filter(p => p.status === 'planning').length,
      inProgress: projects.filter(p => p.status === 'in-progress').length,
      onHold: projects.filter(p => p.status === 'on-hold').length,
      completed: projects.filter(p => p.status === 'completed').length,
      cancelled: projects.filter(p => p.status === 'cancelled').length
    };

    // Financial statistics
    const financialStats = {
      totalEstimatedBudget: projects.reduce((sum, p) => sum + (p.budget.estimated || 0), 0),
      totalActualBudget: projects.reduce((sum, p) => sum + (p.budget.actual || 0), 0),
      averageBudgetUtilization: 0
    };

    if (financialStats.totalEstimatedBudget > 0) {
      financialStats.averageBudgetUtilization = Math.round(
        (financialStats.totalActualBudget / financialStats.totalEstimatedBudget) * 100
      );
    }

    // Timeline events count
    const timelineEventCount = await TimelineEvent.countDocuments({
      project: { $in: projects.map(p => p._id) }
    });

    // Media count
    const mediaCount = await Media.countDocuments({
      project: { $in: projects.map(p => p._id) }
    });

    // Invoice statistics
    const invoiceStats = await Invoice.aggregate([
      { $match: { client: mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$total' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        projectStats,
        financialStats,
        engagementStats: {
          timelineEvents: timelineEventCount,
          mediaFiles: mediaCount
        },
        invoiceStats
      }
    });
  } catch (error) {
    console.error('Get client statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get client statistics',
      error: error.message
    });
  }
});

module.exports = router;