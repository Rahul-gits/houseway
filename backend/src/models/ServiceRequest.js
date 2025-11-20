const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  requestType: {
    type: String,
    required: [true, 'Request type is required'],
    enum: {
      values: [
        'professional-photography',
        'photo-editing',
        'graphic-design',
        'video-production',
        'content-creation',
        'marketing-materials',
        'other'
      ],
      message: 'Invalid request type',
    },
  },
  title: {
    type: String,
    required: [true, 'Request title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
  },
  description: {
    type: String,
    required: [true, 'Request description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requester is required'],
  },
  assignedVendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'assigned', 'in-progress', 'completed', 'cancelled'],
      message: 'Status must be one of: pending, assigned, in-progress, completed, cancelled',
    },
    default: 'pending',
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: 'Priority must be one of: low, medium, high, urgent',
    },
    default: 'medium',
  },
  budget: {
    estimated: {
      type: Number,
      min: [0, 'Budget cannot be negative'],
    },
    approved: {
      type: Number,
      min: [0, 'Approved budget cannot be negative'],
    },
    currency: {
      type: String,
      default: 'USD',
    },
  },
  timeline: {
    requestedDate: {
      type: Date,
      default: Date.now,
    },
    expectedDelivery: {
      type: Date,
    },
    actualDelivery: {
      type: Date,
    },
  },
  requirements: {
    specifications: [String],
    deliverables: [String],
    format: String,
    dimensions: String,
    additionalNotes: String,
  },
  attachments: [{
    name: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['reference', 'brief', 'sample', 'other'],
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  deliverables: [{
    name: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['final', 'draft', 'revision', 'source'],
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  communication: [{
    message: {
      type: String,
      required: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    isInternal: {
      type: Boolean,
      default: false,
    },
  }],
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
      maxlength: [500, 'Feedback cannot exceed 500 characters'],
    },
    ratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    ratedAt: {
      type: Date,
    },
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
serviceRequestSchema.index({ requestedBy: 1, status: 1 });
serviceRequestSchema.index({ assignedVendor: 1, status: 1 });
serviceRequestSchema.index({ requestType: 1, status: 1 });
serviceRequestSchema.index({ createdAt: -1 });

// Virtual for request age
serviceRequestSchema.virtual('requestAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)); // days
});

// Virtual for is overdue
serviceRequestSchema.virtual('isOverdue').get(function() {
  if (!this.timeline.expectedDelivery) return false;
  return this.timeline.expectedDelivery < new Date() && this.status !== 'completed';
});

// Method to add communication
serviceRequestSchema.methods.addCommunication = function(message, sender, isInternal = false) {
  this.communication.push({
    message,
    sender,
    isInternal,
    timestamp: new Date(),
  });
  return this.save();
};

// Method to update status
serviceRequestSchema.methods.updateStatus = function(newStatus, updatedBy) {
  const oldStatus = this.status;
  this.status = newStatus;
  
  // Add automatic communication for status changes
  const statusMessages = {
    assigned: 'Request has been assigned to a vendor',
    'in-progress': 'Work has started on this request',
    completed: 'Request has been completed',
    cancelled: 'Request has been cancelled',
  };
  
  if (statusMessages[newStatus]) {
    this.addCommunication(statusMessages[newStatus], updatedBy, true);
  }
  
  return this.save();
};

// Static method to get requests by user role
serviceRequestSchema.statics.getByUserRole = function(user, filters = {}) {
  let query = { ...filters };
  
  switch (user.role) {
    case 'owner':
      // Owner can see all requests
      break;
    case 'vendor':
      // Vendor can see assigned requests
      query.assignedVendor = user._id;
      break;
    case 'client':
    case 'employee':
      // Clients and employees can see their own requests
      query.requestedBy = user._id;
      break;
    default:
      // No access for other roles
      query._id = null;
  }
  
  return this.find(query)
    .populate('requestedBy', 'firstName lastName email')
    .populate('assignedVendor', 'firstName lastName email vendorDetails')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
