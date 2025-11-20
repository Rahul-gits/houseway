const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required']
  },
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required'],
    enum: {
      values: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime', 'application/pdf'],
      message: 'Invalid MIME type. Supported types: images (jpeg, png, gif), videos (mp4, mov), PDF'
    }
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [1, 'File size must be greater than 0'],
    max: [20 * 1024 * 1024, 'File size cannot exceed 20MB'] // 20MB limit
  },
  url: {
    type: String,
    required: [true, 'File URL is required']
  },
  thumbnailUrl: {
    type: String,
    trim: true
  },
  caption: {
    type: String,
    trim: true,
    maxlength: [500, 'Caption cannot exceed 500 characters']
  },
  tags: [String],
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploader information is required']
  },
  category: {
    type: String,
    enum: {
      values: ['progress', 'design', 'reference', 'inspiration', 'material', 'completion'],
      message: 'Category must be one of: progress, design, reference, inspiration, material, completion'
    },
    default: 'progress'
  },
  featured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
});

// Indexes for better query performance
mediaSchema.index({ project: 1, createdAt: -1 });
mediaSchema.index({ uploadedBy: 1 });
mediaSchema.index({ category: 1 });
mediaSchema.index({ featured: 1 });
mediaSchema.index({ tags: 1 });
mediaSchema.index({ mimeType: 1 });

// Virtual for file type category
mediaSchema.virtual('fileType').get(function() {
  if (this.mimeType.startsWith('image/')) return 'image';
  if (this.mimeType.startsWith('video/')) return 'video';
  if (this.mimeType === 'application/pdf') return 'document';
  return 'other';
});

// Virtual for formatted file size
mediaSchema.virtual('formattedSize').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Static method to find media by project
mediaSchema.statics.findByProject = function(projectId, category = null) {
  const query = { project: projectId };
  if (category) {
    query.category = category;
  }
  return this.find(query)
    .populate('uploadedBy', 'firstName lastName')
    .sort({ createdAt: -1 });
};

// Static method to find featured media by project
mediaSchema.statics.findFeaturedByProject = function(projectId) {
  return this.find({ project: projectId, featured: true })
    .populate('uploadedBy', 'firstName lastName')
    .sort({ createdAt: -1 });
};

// Static method to find media by category
mediaSchema.statics.findByCategory = function(category, limit = 20) {
  return this.find({ category })
    .populate('project', 'title')
    .populate('uploadedBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Instance method to toggle featured status
mediaSchema.methods.toggleFeatured = function() {
  this.featured = !this.featured;
  return this.save();
};

// Instance method to add tag
mediaSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
  return this.save();
};

// Instance method to remove tag
mediaSchema.methods.removeTag = function(tag) {
  this.tags = this.tags.filter(t => t !== tag);
  return this.save();
};

// Pre-save middleware to validate URL format
mediaSchema.pre('save', function(next) {
  try {
    new URL(this.url);
    next();
  } catch (error) {
    next(new Error('Invalid URL format'));
  }
});

module.exports = mongoose.model('Media', mediaSchema);