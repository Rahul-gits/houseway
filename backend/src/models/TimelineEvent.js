const mongoose = require('mongoose');

const timelineEventSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required']
  },
  eventType: {
    type: String,
    enum: {
      values: ['milestone', 'update', 'media', 'invoice', 'note', 'meeting'],
      message: 'Event type must be one of: milestone, update, media, invoice, note, meeting'
    },
    required: [true, 'Event type is required']
  },
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Event title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Event description cannot exceed 1000 characters']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required']
  },
  visibility: {
    type: String,
    enum: {
      values: ['public', 'internal'],
      message: 'Visibility must be either public or internal'
    },
    default: 'public'
  },
  media: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media'
  }],
  tags: [String],
  eventDate: {
    type: Date,
    required: [true, 'Event date is required'],
    default: Date.now
  },
  metadata: {
    // Event-type specific data
    milestoneData: {
      completedDate: Date,
      nextStep: String
    },
    meetingData: {
      duration: Number,
      attendees: [String],
      location: String
    }
  }
}, {
  timestamps: true,
});

// Indexes for better query performance
timelineEventSchema.index({ project: 1, eventDate: -1 });
timelineEventSchema.index({ author: 1 });
timelineEventSchema.index({ eventType: 1 });
timelineEventSchema.index({ visibility: 1 });
timelineEventSchema.index({ tags: 1 });

// Virtual for formatted event date
timelineEventSchema.virtual('formattedEventDate').get(function() {
  return this.eventDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Static method to find timeline events by project
timelineEventSchema.statics.findByProject = function(projectId, visibility = 'public') {
  const query = { project: projectId };
  if (visibility === 'public') {
    query.visibility = 'public';
  }
  return this.find(query)
    .populate('author', 'firstName lastName profileImage')
    .populate('media')
    .sort({ eventDate: -1 });
};

// Static method to find recent events by user
timelineEventSchema.statics.findRecentByUser = function(userId, limit = 10) {
  return this.find({ author: userId })
    .populate('project', 'title')
    .sort({ eventDate: -1 })
    .limit(limit);
};

// Instance method to add media reference
timelineEventSchema.methods.addMedia = function(mediaId) {
  if (!this.media.includes(mediaId)) {
    this.media.push(mediaId);
  }
  return this.save();
};

// Instance method to remove media reference
timelineEventSchema.methods.removeMedia = function(mediaId) {
  this.media = this.media.filter(id => id.toString() !== mediaId.toString());
  return this.save();
};

module.exports = mongoose.model('TimelineEvent', timelineEventSchema);