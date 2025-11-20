const express = require('express');
const router = express.Router();
const { authenticate, authorize, isOwner } = require('../middleware/auth');
const MaterialRequest = require('../models/MaterialRequest');
const Quotation = require('../models/Quotation');
const Project = require('../models/Project');
const PurchaseOrder = require('../models/PurchaseOrder');

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get general dashboard stats (Owner only)
 * @access  Private (Owner only)
 */
router.get('/stats', authenticate, isOwner, async (req, res) => {
  try {
    // Get counts for various entities
    const [
      totalProjects,
      totalMaterialRequests,
      totalQuotations,
      totalPurchaseOrders,
      pendingMaterialRequests,
      pendingQuotations,
      approvedQuotations
    ] = await Promise.all([
      Project.countDocuments(),
      MaterialRequest.countDocuments(),
      Quotation.countDocuments(),
      PurchaseOrder.countDocuments(),
      MaterialRequest.countDocuments({ status: 'pending' }),
      Quotation.countDocuments({ status: 'submitted' }),
      Quotation.countDocuments({ status: 'approved' })
    ]);

    res.json({
      success: true,
      data: {
        projects: totalProjects,
        materialRequests: totalMaterialRequests,
        quotations: totalQuotations,
        purchaseOrders: totalPurchaseOrders,
        pendingMaterialRequests,
        pendingQuotations,
        approvedQuotations
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard stats',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/dashboard/vendor-stats
 * @desc    Get vendor-specific dashboard stats
 * @access  Private (Vendor only)
 */
router.get('/vendor-stats', authenticate, authorize('vendor'), async (req, res) => {
  try {
    // Get vendor-specific counts
    const [
      totalRequests,
      pendingQuotations,
      approvedQuotations,
      quotations
    ] = await Promise.all([
      MaterialRequest.countDocuments({ 'assignedVendors.vendor': req.user._id, status: 'approved' }),
      Quotation.countDocuments({ vendor: req.user._id, status: 'pending' }),
      Quotation.countDocuments({ vendor: req.user._id, status: 'approved' }),
      Quotation.find({ vendor: req.user._id, status: 'approved' }).select('totalAmount')
    ]);

    // Calculate total revenue from approved quotations
    const totalRevenue = quotations.reduce((sum, quotation) => sum + (quotation.totalAmount || 0), 0);

    res.json({
      success: true,
      data: {
        totalRequests,
        pendingQuotations,
        approvedQuotations,
        totalRevenue
      }
    });
  } catch (error) {
    console.error('Vendor dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get vendor dashboard stats',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/dashboard/client-stats
 * @desc    Get client-specific dashboard stats
 * @access  Private (Client only)
 */
router.get('/client-stats', authenticate, authorize('client'), async (req, res) => {
  try {
    // Get client projects
    const projects = await Project.find({ client: req.user._id });
    const projectIds = projects.map(project => project._id);

    // Get counts for client's projects
    const [
      totalProjects,
      activeProjects,
      completedProjects,
      totalMaterialRequests,
      pendingMaterialRequests
    ] = await Promise.all([
      Project.countDocuments({ client: req.user._id }),
      Project.countDocuments({ client: req.user._id, status: { $in: ['planning', 'in-progress'] } }),
      Project.countDocuments({ client: req.user._id, status: 'completed' }),
      MaterialRequest.countDocuments({ project: { $in: projectIds } }),
      MaterialRequest.countDocuments({ project: { $in: projectIds }, status: 'pending' })
    ]);

    res.json({
      success: true,
      data: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalMaterialRequests,
        pendingMaterialRequests
      }
    });
  } catch (error) {
    console.error('Client dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get client dashboard stats',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/dashboard/employee-stats
 * @desc    Get employee-specific dashboard stats
 * @access  Private (Employee only)
 */
router.get('/employee-stats', authenticate, authorize('employee'), async (req, res) => {
  try {
    // Get employee projects
    const projects = await Project.find({ assignedEmployees: req.user._id });
    const projectIds = projects.map(project => project._id);

    // Get counts for employee's projects
    const [
      assignedProjects,
      activeProjects,
      pendingMaterialRequests,
      pendingQuotations
    ] = await Promise.all([
      Project.countDocuments({ assignedEmployees: req.user._id }),
      Project.countDocuments({ assignedEmployees: req.user._id, status: { $in: ['planning', 'in-progress'] } }),
      MaterialRequest.countDocuments({ project: { $in: projectIds }, status: 'pending' }),
      Quotation.countDocuments({ 'materialRequest.project': { $in: projectIds }, status: 'submitted' })
    ]);

    res.json({
      success: true,
      data: {
        assignedProjects,
        activeProjects,
        pendingMaterialRequests,
        pendingQuotations
      }
    });
  } catch (error) {
    console.error('Employee dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get employee dashboard stats',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/dashboard/owner-stats
 * @desc    Get owner-specific dashboard stats
 * @access  Private (Owner only)
 */
router.get('/owner-stats', authenticate, isOwner, async (req, res) => {
  try {
    // Get counts for all entities
    const [
      totalProjects,
      activeProjects,
      totalClients,
      totalEmployees,
      totalVendors,
      pendingMaterialRequests,
      pendingQuotations,
      pendingPurchaseOrders
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: { $in: ['planning', 'in-progress'] } }),
      Project.distinct('client').then(clients => clients.length),
      Project.distinct('assignedEmployees').then(employees => employees.length),
      MaterialRequest.distinct('assignedVendors.vendor').then(vendors => vendors.length),
      MaterialRequest.countDocuments({ status: 'pending' }),
      Quotation.countDocuments({ status: 'submitted' }),
      PurchaseOrder.countDocuments({ status: 'pending' })
    ]);

    res.json({
      success: true,
      data: {
        totalProjects,
        activeProjects,
        totalClients,
        totalEmployees,
        totalVendors,
        pendingMaterialRequests,
        pendingQuotations,
        pendingPurchaseOrders
      }
    });
  } catch (error) {
    console.error('Owner dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get owner dashboard stats',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/dashboard/recent-activity
 * @desc    Get recent activity across the system
 * @access  Private (Role-based)
 */
router.get('/recent-activity', authenticate, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    let activities = [];

    // Different activity queries based on user role
    if (req.user.role === 'owner') {
      // Owner can see all recent activities
      const [projects, materialRequests, quotations] = await Promise.all([
        Project.find({}, 'title status createdAt')
          .sort({ createdAt: -1 })
          .limit(limit),
        MaterialRequest.find({}, 'title status createdAt')
          .populate('project', 'title')
          .sort({ createdAt: -1 })
          .limit(limit),
        Quotation.find({}, 'title status createdAt')
          .populate('materialRequest', 'title')
          .sort({ createdAt: -1 })
          .limit(limit)
      ]);

      activities = [
        ...projects.map(p => ({
          type: 'project',
          title: p.title,
          status: p.status,
          createdAt: p.createdAt,
          message: `Project ${p.title} was created`
        })),
        ...materialRequests.map(mr => ({
          type: 'materialRequest',
          title: mr.title,
          status: mr.status,
          createdAt: mr.createdAt,
          message: `Material request for ${mr.project?.title || 'project'} was created`
        })),
        ...quotations.map(q => ({
          type: 'quotation',
          title: q.title,
          status: q.status,
          createdAt: q.createdAt,
          message: `Quotation for ${q.materialRequest?.title || 'material request'} was submitted`
        }))
      ];
    } else if (req.user.role === 'vendor') {
      // Vendor can see their quotations and assigned material requests
      const [materialRequests, quotations] = await Promise.all([
        MaterialRequest.find({ 'assignedVendors.vendor': req.user._id })
          .populate('project', 'title')
          .sort({ createdAt: -1 })
          .limit(limit),
        Quotation.find({ vendor: req.user._id })
          .populate('materialRequest', 'title')
          .sort({ createdAt: -1 })
          .limit(limit)
      ]);

      activities = [
        ...materialRequests.map(mr => ({
          type: 'materialRequest',
          title: mr.title,
          status: mr.status,
          createdAt: mr.createdAt,
          message: `You were assigned to material request for ${mr.project?.title || 'project'}`
        })),
        ...quotations.map(q => ({
          type: 'quotation',
          title: q.title,
          status: q.status,
          createdAt: q.createdAt,
          message: `Your quotation for ${q.materialRequest?.title || 'material request'} was ${q.status}`
        }))
      ];
    } else if (req.user.role === 'client') {
      // Client can see their projects and material requests
      const projects = await Project.find({ client: req.user._id })
        .sort({ createdAt: -1 })
        .limit(limit);

      const projectIds = projects.map(p => p._id);
      const materialRequests = await MaterialRequest.find({ project: { $in: projectIds } })
        .populate('project', 'title')
        .sort({ createdAt: -1 })
        .limit(limit);

      activities = [
        ...projects.map(p => ({
          type: 'project',
          title: p.title,
          status: p.status,
          createdAt: p.createdAt,
          message: `Your project ${p.title} was created`
        })),
        ...materialRequests.map(mr => ({
          type: 'materialRequest',
          title: mr.title,
          status: mr.status,
          createdAt: mr.createdAt,
          message: `Material request for ${mr.project?.title || 'your project'} was created`
        }))
      ];
    } else if (req.user.role === 'employee') {
      // Employee can see assigned projects and related material requests
      const projects = await Project.find({ assignedEmployees: req.user._id })
        .sort({ createdAt: -1 })
        .limit(limit);

      const projectIds = projects.map(p => p._id);
      const materialRequests = await MaterialRequest.find({ project: { $in: projectIds } })
        .populate('project', 'title')
        .sort({ createdAt: -1 })
        .limit(limit);

      activities = [
        ...projects.map(p => ({
          type: 'project',
          title: p.title,
          status: p.status,
          createdAt: p.createdAt,
          message: `You were assigned to project ${p.title}`
        })),
        ...materialRequests.map(mr => ({
          type: 'materialRequest',
          title: mr.title,
          status: mr.status,
          createdAt: mr.createdAt,
          message: `Material request for ${mr.project?.title || 'assigned project'} was created`
        }))
      ];
    }

    // Sort all activities by date and limit
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    activities = activities.slice(0, parseInt(limit));

    // Format activities with proper time field
    const formattedActivities = activities.map(activity => ({
      ...activity,
      time: getTimeAgo(activity.createdAt)
    }));

    res.json({
      success: true,
      data: { activities: formattedActivities }
    });
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent activity',
      error: error.message
    });
  }
});

// Helper function to format time ago
const getTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hrs ago`;
  return `${Math.floor(diffInMinutes / 1440)} days ago`;
};

module.exports = router;