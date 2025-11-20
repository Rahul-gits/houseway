const express = require('express');
const router = express.Router();

const TimelineEvent = require('../models/TimelineEvent');
const Project = require('../models/Project');
const Media = require('../models/Media');

const { authenticate, requireRole, authorizeProjectAccess } = require('../middleware/auth');

/**
 * @route   GET /api/timeline/:projectId
 * @desc    Get project timeline with filtering
 * @access  Private
 */
router.get('/:projectId', authenticate, authorizeProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      page = 1,
      limit = 20,
      eventType = 'all',
      visibility = 'public',
      startDate,
      endDate
    } = req.query;

    // Build query
    const query = { project: projectId };

    // Add event type filter
    if (eventType !== 'all') {
      query.eventType = eventType;
    }

    // Add visibility filter (only employees and owners can see internal events)
    if (req.user.role === 'client') {
      query.visibility = 'public';
    } else if (visibility !== 'all') {
      query.visibility = visibility;
    }

    // Add date range filter
    if (startDate || endDate) {
      query.eventDate = {};
      if (startDate) query.eventDate.$gte = new Date(startDate);
      if (endDate) query.eventDate.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (page - 1) * limit;

    const events = await TimelineEvent.find(query)
      .populate('author', 'firstName lastName profileImage')
      .populate('media')
      .sort({ eventDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await TimelineEvent.countDocuments(query);

    // Get event statistics
    const eventStats = await TimelineEvent.aggregate([
      { $match: { project: mongoose.Types.ObjectId(projectId) } },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        events,
        eventStats: eventStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
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
    console.error('Get timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get timeline',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/timeline
 * @desc    Create timeline event
 * @access  Private (Employee, Owner)
 */
router.post('/', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
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

    // Validate project exists and user has access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Validate event type
    const validEventTypes = ['milestone', 'update', 'media', 'invoice', 'note', 'meeting'];
    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event type'
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

    // Populate related information
    await timelineEvent.populate([
      { path: 'author', select: 'firstName lastName profileImage' },
      { path: 'media' }
    ]);

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
 * @route   PUT /api/timeline/:id
 * @desc    Update timeline event
 * @access  Private (Author or Owner)
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      visibility,
      tags,
      eventDate,
      metadata
    } = req.body;

    // Find timeline event
    const timelineEvent = await TimelineEvent.findById(id);
    if (!timelineEvent) {
      return res.status(404).json({
        success: false,
        message: 'Timeline event not found'
      });
    }

    // Check permissions (only author or owner can update)
    if (timelineEvent.author.toString() !== req.user._id.toString() && req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this timeline event'
      });
    }

    // Update fields
    const allowedUpdates = ['title', 'description', 'visibility', 'tags', 'eventDate', 'metadata'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const updatedEvent = await TimelineEvent.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('author', 'firstName lastName profileImage')
      .populate('media');

    res.json({
      success: true,
      message: 'Timeline event updated successfully',
      data: {
        timelineEvent: updatedEvent
      }
    });
  } catch (error) {
    console.error('Update timeline event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update timeline event',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/timeline/:id
 * @desc    Delete timeline event
 * @access  Private (Author or Owner)
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Find timeline event
    const timelineEvent = await TimelineEvent.findById(id);
    if (!timelineEvent) {
      return res.status(404).json({
        success: false,
        message: 'Timeline event not found'
      });
    }

    // Check permissions (only author or owner can delete)
    if (timelineEvent.author.toString() !== req.user._id.toString() && req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this timeline event'
      });
    }

    await TimelineEvent.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Timeline event deleted successfully'
    });
  } catch (error) {
    console.error('Delete timeline event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete timeline event',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/timeline/:id/media
 * @desc    Add media to timeline event
 * @access  Private (Author or Owner)
 */
router.post('/:id/media', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { mediaId } = req.body;

    // Find timeline event
    const timelineEvent = await TimelineEvent.findById(id);
    if (!timelineEvent) {
      return res.status(404).json({
        success: false,
        message: 'Timeline event not found'
      });
    }

    // Check permissions
    if (timelineEvent.author.toString() !== req.user._id.toString() && req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this timeline event'
      });
    }

    // Validate media exists and belongs to the same project
    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    if (media.project.toString() !== timelineEvent.project.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Media does not belong to the same project'
      });
    }

    // Add media to timeline event
    await timelineEvent.addMedia(mediaId);

    // Populate updated event with media
    const updatedEvent = await TimelineEvent.findById(id)
      .populate('author', 'firstName lastName profileImage')
      .populate('media');

    res.json({
      success: true,
      message: 'Media added to timeline event successfully',
      data: {
        timelineEvent: updatedEvent
      }
    });
  } catch (error) {
    console.error('Add media to timeline event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add media to timeline event',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/timeline/:id/media/:mediaId
 * @desc    Remove media from timeline event
 * @access  Private (Author or Owner)
 */
router.delete('/:id/media/:mediaId', authenticate, async (req, res) => {
  try {
    const { id, mediaId } = req.params;

    // Find timeline event
    const timelineEvent = await TimelineEvent.findById(id);
    if (!timelineEvent) {
      return res.status(404).json({
        success: false,
        message: 'Timeline event not found'
      });
    }

    // Check permissions
    if (timelineEvent.author.toString() !== req.user._id.toString() && req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this timeline event'
      });
    }

    // Remove media from timeline event
    await timelineEvent.removeMedia(mediaId);

    // Populate updated event
    const updatedEvent = await TimelineEvent.findById(id)
      .populate('author', 'firstName lastName profileImage')
      .populate('media');

    res.json({
      success: true,
      message: 'Media removed from timeline event successfully',
      data: {
        timelineEvent: updatedEvent
      }
    });
  } catch (error) {
    console.error('Remove media from timeline event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove media from timeline event',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/timeline/recent/:userId
 * @desc    Get recent timeline events for a user
 * @access  Private
 */
router.get('/recent/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10 } = req.query;

    // Users can only see their own recent events unless they're owner or employee
    if (userId !== req.user._id.toString() && !['owner', 'employee'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these events'
      });
    }

    const events = await TimelineEvent.findRecentByUser(userId, parseInt(limit));

    res.json({
      success: true,
      data: {
        events
      }
    });
  } catch (error) {
    console.error('Get recent timeline events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent timeline events',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/timeline/milestones/:projectId
 * @desc    Get project milestones
 * @access  Private
 */
router.get('/milestones/:projectId', authenticate, authorizeProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;

    const milestones = await TimelineEvent.find({
      project: projectId,
      eventType: 'milestone',
      visibility: req.user.role === 'client' ? 'public' : { $in: ['public', 'internal'] }
    })
      .populate('author', 'firstName lastName')
      .sort({ eventDate: 1 });

    res.json({
      success: true,
      data: {
        milestones
      }
    });
  } catch (error) {
    console.error('Get milestones error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get milestones',
      error: error.message
    });
  }
});

module.exports = router;