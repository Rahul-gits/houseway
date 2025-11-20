const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: [100, 'Project title cannot exceed 100 characters'],
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    trim: true,
    maxlength: [1000, 'Project description cannot exceed 1000 characters'],
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Client is required'],
  },
  assignedEmployees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  assignedVendors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  status: {
    type: String,
    enum: {
      values: ['planning', 'in-progress', 'on-hold', 'completed', 'cancelled'],
      message: 'Status must be one of: planning, in-progress, on-hold, completed, cancelled',
    },
    default: 'planning',
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
      min: [0, 'Estimated budget cannot be negative'],
    },
    actual: {
      type: Number,
      min: [0, 'Actual budget cannot be negative'],
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
  },
  timeline: {
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    expectedEndDate: {
      type: Date,
      required: [true, 'Expected end date is required'],
    },
    actualEndDate: {
      type: Date,
      default: null,
    },
  },
  location: {
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
  },
  projectType: {
    type: String,
    enum: {
      values: ['residential', 'commercial', 'industrial', 'renovation', 'interior'],
      message: 'Project type must be one of: residential, commercial, industrial, renovation, interior',
    },
    required: [true, 'Project type is required'],
  },
  designStyle: {
    type: String,
    enum: {
      values: ['modern', 'traditional', 'contemporary', 'minimalist', 'rustic', 'industrial', 'eclectic'],
      message: 'Design style must be one of: modern, traditional, contemporary, minimalist, rustic, industrial, eclectic',
    },
  },
  specifications: {
    area: {
      type: Number,
      min: [0, 'Area cannot be negative'],
    },
    areaUnit: {
      type: String,
      enum: ['sqft', 'sqm'],
      default: 'sqft',
    },
    floors: {
      type: Number,
      min: [1, 'Number of floors must be at least 1'],
      default: 1,
    },
    bedrooms: Number,
    bathrooms: Number,
    parking: Number,
  },
  documents: [{
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
      enum: ['design', 'approval', 'contract', 'invoice', 'other'],
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
  images: [{
    name: String,
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['design', 'progress', 'final', 'reference'],
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
  progress: {
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    milestones: [{
      name: {
        type: String,
        required: true,
      },
      description: String,
      targetDate: Date,
      completedDate: Date,
      status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'delayed'],
        default: 'pending',
      },
    }],
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  notes: [{
    content: {
      type: String,
      required: true,
      maxlength: [500, 'Note content cannot exceed 500 characters'],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
projectSchema.index({ client: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ assignedEmployees: 1 });
projectSchema.index({ assignedVendors: 1 });
projectSchema.index({ createdAt: -1 });
projectSchema.index({ 'timeline.startDate': 1 });
projectSchema.index({ 'timeline.expectedEndDate': 1 });

// Virtual for project duration in days
projectSchema.virtual('duration').get(function() {
  if (this.timeline.startDate && this.timeline.expectedEndDate) {
    const diffTime = Math.abs(this.timeline.expectedEndDate - this.timeline.startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Virtual for days remaining
projectSchema.virtual('daysRemaining').get(function() {
  if (this.timeline.expectedEndDate && this.status !== 'completed') {
    const diffTime = this.timeline.expectedEndDate - new Date();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Virtual for budget utilization percentage
projectSchema.virtual('budgetUtilization').get(function() {
  if (this.budget.estimated && this.budget.actual) {
    return Math.round((this.budget.actual / this.budget.estimated) * 100);
  }
  return 0;
});

// Pre-save middleware to validate dates
projectSchema.pre('save', function(next) {
  if (this.timeline.startDate && this.timeline.expectedEndDate) {
    if (this.timeline.startDate >= this.timeline.expectedEndDate) {
      return next(new Error('Expected end date must be after start date'));
    }
  }
  
  if (this.timeline.actualEndDate && this.timeline.startDate) {
    if (this.timeline.actualEndDate < this.timeline.startDate) {
      return next(new Error('Actual end date cannot be before start date'));
    }
  }
  
  next();
});

// Static method to find projects by client
projectSchema.statics.findByClient = function(clientId) {
  return this.find({ client: clientId }).populate('client assignedEmployees assignedVendors');
};

// Static method to find projects by employee
projectSchema.statics.findByEmployee = function(employeeId) {
  return this.find({ assignedEmployees: employeeId }).populate('client assignedEmployees assignedVendors');
};

// Static method to find projects by vendor
projectSchema.statics.findByVendor = function(vendorId) {
  return this.find({ assignedVendors: vendorId }).populate('client assignedEmployees assignedVendors');
};

// Instance method to add progress update
projectSchema.methods.updateProgress = function(percentage, updatedBy) {
  this.progress.percentage = percentage;
  this.progress.lastUpdated = new Date();
  this.progress.updatedBy = updatedBy;
  return this.save();
};

// Instance method to add note
projectSchema.methods.addNote = function(content, author, isPrivate = false) {
  this.notes.push({
    content,
    author,
    isPrivate,
  });
  return this.save();
};

module.exports = mongoose.model('Project', projectSchema);
