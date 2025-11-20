const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Media = require('../models/Media');
const Project = require('../models/Project');

const { authenticate, requireRole, authorizeProjectAccess } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/media';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
    files: 5 // Maximum 5 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, videos, and PDFs are allowed.'));
    }
  }
});

/**
 * @route   GET /api/media/:projectId
 * @desc    Get project media with filtering
 * @access  Private
 */
router.get('/:projectId', authenticate, authorizeProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      page = 1,
      limit = 20,
      category = 'all',
      fileType = 'all',
      featured = 'all'
    } = req.query;

    // Build query
    const query = { project: projectId };

    // Add category filter
    if (category !== 'all') {
      query.category = category;
    }

    // Add file type filter
    if (fileType !== 'all') {
      const mimeTypes = {
        'image': ['image/jpeg', 'image/png', 'image/gif'],
        'video': ['video/mp4', 'video/quicktime'],
        'document': ['application/pdf']
      };
      if (mimeTypes[fileType]) {
        query.mimeType = { $in: mimeTypes[fileType] };
      }
    }

    // Add featured filter
    if (featured === 'featured') {
      query.featured = true;
    } else if (featured === 'not-featured') {
      query.featured = false;
    }

    // Pagination
    const skip = (page - 1) * limit;

    const media = await Media.find(query)
      .populate('uploadedBy', 'firstName lastName profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Media.countDocuments(query);

    // Get media statistics
    const mediaStats = await Media.aggregate([
      { $match: { project: mongoose.Types.ObjectId(projectId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          featured: { $sum: { $cond: ['$featured', 1, 0] } },
          totalSize: { $sum: '$size' },
          byCategory: {
            $push: '$category'
          }
        }
      }
    ]);

    const stats = mediaStats[0] || {
      total: 0,
      featured: 0,
      totalSize: 0,
      byCategory: []
    };

    res.json({
      success: true,
      data: {
        media,
        stats: {
          ...stats,
          byCategory: stats.byCategory.reduce((acc, cat) => {
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {})
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get media',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/media/upload
 * @desc    Upload media to project
 * @access  Private (Employee, Owner)
 */
router.post('/upload', authenticate, requireRole(['employee', 'owner']), upload.array('files', 5), async (req, res) => {
  try {
    const { projectId, category = 'progress', caption = '', tags = [] } = req.body;

    // Validate project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Create media documents for each uploaded file
    const uploadedMedia = [];
    for (const file of req.files) {
      const media = new Media({
        project: projectId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/uploads/media/${file.filename}`,
        caption,
        tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
        uploadedBy: req.user._id,
        category
      });

      await media.save();
      await media.populate('uploadedBy', 'firstName lastName');

      uploadedMedia.push(media);
    }

    res.status(201).json({
      success: true,
      message: `${uploadedMedia.length} media files uploaded successfully`,
      data: {
        media: uploadedMedia
      }
    });
  } catch (error) {
    console.error('Upload media error:', error);

    // Clean up uploaded files if there was an error
    if (req.files) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload media',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/media/:id
 * @desc    Update media details
 * @access  Private (Uploader or Owner)
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, category, tags, featured } = req.body;

    // Find media
    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // Check permissions
    if (media.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this media'
      });
    }

    // Update fields
    const allowedUpdates = ['caption', 'category', 'tags', 'featured'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        if (key === 'tags' && typeof req.body[key] === 'string') {
          updates[key] = req.body[key].split(',').map(t => t.trim());
        } else {
          updates[key] = req.body[key];
        }
      }
    });

    const updatedMedia = await Media.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('uploadedBy', 'firstName lastName')
      .populate('project', 'title');

    res.json({
      success: true,
      message: 'Media updated successfully',
      data: {
        media: updatedMedia
      }
    });
  } catch (error) {
    console.error('Update media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update media',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/media/:id
 * @desc    Delete media
 * @access  Private (Uploader or Owner)
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Find media
    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // Check permissions
    if (media.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this media'
      });
    }

    // Delete physical file
    const filePath = path.join('uploads/media', media.filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.error('Error deleting file:', fileError);
    }

    // Delete media document
    await Media.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Media deleted successfully'
    });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/media/:id/thumbnail
 * @desc    Get media thumbnail (for images)
 * @access  Public
 */
router.get('/:id/thumbnail', async (req, res) => {
  try {
    const { id } = req.params;

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // For now, return the original file. In production, you might want to
    // generate actual thumbnails using a library like sharp
    if (media.mimeType.startsWith('image/')) {
      const filePath = path.join('uploads/media', media.filename);
      if (fs.existsSync(filePath)) {
        res.sendFile(path.resolve(filePath));
      } else {
        res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'Thumbnail not available for this file type'
      });
    }
  } catch (error) {
    console.error('Get thumbnail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get thumbnail',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/media/:id/toggle-featured
 * @desc    Toggle featured status of media
 * @access  Private (Employee, Owner)
 */
router.post('/:id/toggle-featured', authenticate, requireRole(['employee', 'owner']), async (req, res) => {
  try {
    const { id } = req.params;

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    await media.toggleFeatured();

    res.json({
      success: true,
      message: `Media ${media.featured ? 'featured' : 'unfeatured'} successfully`,
      data: {
        featured: media.featured
      }
    });
  } catch (error) {
    console.error('Toggle featured error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle featured status',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/media/featured/:projectId
 * @desc    Get featured media for a project
 * @access  Private
 */
router.get('/featured/:projectId', authenticate, authorizeProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 6 } = req.query;

    const media = await Media.findFeaturedByProject(projectId)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        media
      }
    });
  } catch (error) {
    console.error('Get featured media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get featured media',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/media/gallery/:projectId
 * @desc    Get gallery view of project media
 * @access  Private
 */
router.get('/gallery/:projectId', authenticate, authorizeProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 12 } = req.query;

    // Get only images and videos for gallery
    const query = {
      project: projectId,
      mimeType: { $in: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'] }
    };

    const skip = (page - 1) * limit;

    const media = await Media.find(query)
      .select('filename mimeType originalName caption featured tags createdAt')
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

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
    console.error('Get gallery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get gallery',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/media/:id/tags
 * @desc    Add tag to media
 * @access  Private (Uploader or Owner)
 */
router.post('/:id/tags', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { tag } = req.body;

    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid tag is required'
      });
    }

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // Check permissions
    if (media.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this media'
      });
    }

    await media.addTag(tag.trim());

    res.json({
      success: true,
      message: 'Tag added successfully',
      data: {
        tags: media.tags
      }
    });
  } catch (error) {
    console.error('Add tag error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add tag',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/media/:id/tags/:tag
 * @desc    Remove tag from media
 * @access  Private (Uploader or Owner)
 */
router.delete('/:id/tags/:tag', authenticate, async (req, res) => {
  try {
    const { id, tag } = req.params;

    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // Check permissions
    if (media.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this media'
      });
    }

    await media.removeTag(tag);

    res.json({
      success: true,
      message: 'Tag removed successfully',
      data: {
        tags: media.tags
      }
    });
  } catch (error) {
    console.error('Remove tag error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove tag',
      error: error.message
    });
  }
});

module.exports = router;