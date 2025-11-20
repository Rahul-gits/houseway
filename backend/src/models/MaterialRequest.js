const mongoose = require('mongoose');

const materialItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Material name is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Material description cannot exceed 200 characters'],
  },
  quantity: {
    type: Number,
    required: [true, 'Material quantity is required'],
    min: [0.01, 'Quantity must be greater than 0'],
  },
  unit: {
    type: String,
    required: [true, 'Material unit is required'],
    enum: {
      values: ['pcs', 'kg', 'lbs', 'sqft', 'sqm', 'cubic_ft', 'cubic_m', 'liters', 'gallons', 'meters', 'feet'],
      message: 'Unit must be one of: pcs, kg, lbs, sqft, sqm, cubic_ft, cubic_m, liters, gallons, meters, feet',
    },
  },
  category: {
    type: String,
    enum: {
      values: ['cement', 'steel', 'wood', 'tiles', 'paint', 'electrical', 'plumbing', 'hardware', 'other'],
      message: 'Category must be one of: cement, steel, wood, tiles, paint, electrical, plumbing, hardware, other',
    },
    required: [true, 'Material category is required'],
  },
  specifications: {
    brand: String,
    model: String,
    color: String,
    size: String,
    grade: String,
    other: String,
  },
  estimatedCost: {
    type: Number,
    min: [0, 'Estimated cost cannot be negative'],
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: 'Priority must be one of: low, medium, high, urgent',
    },
    default: 'medium',
  },
  requiredBy: {
    type: Date,
    required: [true, 'Required by date is required'],
  },
});

const materialRequestSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required'],
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requested by is required'],
  },
  title: {
    type: String,
    required: [true, 'Request title is required'],
    trim: true,
    maxlength: [100, 'Request title cannot exceed 100 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Request description cannot exceed 500 characters'],
  },
  materials: {
    type: [materialItemSchema],
    validate: {
      validator: function(materials) {
        return materials && materials.length > 0;
      },
      message: 'At least one material is required',
    },
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'partially_fulfilled', 'fulfilled'],
      message: 'Status must be one of: pending, approved, rejected, partially_fulfilled, fulfilled',
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
  assignedVendors: [{
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  }],
  totalEstimatedCost: {
    type: Number,
    min: [0, 'Total estimated cost cannot be negative'],
    default: 0,
  },
  actualCost: {
    type: Number,
    min: [0, 'Actual cost cannot be negative'],
    default: 0,
  },
  currency: {
    type: String,
    default: 'USD',
  },
  requiredBy: {
    type: Date,
    required: [true, 'Required by date is required'],
  },
  approvals: [{
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['approved', 'rejected'],
      required: true,
    },
    comments: {
      type: String,
      maxlength: [300, 'Approval comments cannot exceed 300 characters'],
    },
  }],
  attachments: [{
    name: {
      type: String,
      required: true,
    },
    url: {
      type: String,
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
  notes: [{
    content: {
      type: String,
      required: true,
      maxlength: [300, 'Note content cannot exceed 300 characters'],
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
  }],
}, {
  timestamps: true,
});

// Indexes for better query performance
materialRequestSchema.index({ project: 1 });
materialRequestSchema.index({ requestedBy: 1 });
materialRequestSchema.index({ status: 1 });
materialRequestSchema.index({ 'assignedVendors.vendor': 1 });
materialRequestSchema.index({ requiredBy: 1 });
materialRequestSchema.index({ createdAt: -1 });

// Virtual for days until required
materialRequestSchema.virtual('daysUntilRequired').get(function() {
  if (this.requiredBy) {
    const diffTime = this.requiredBy - new Date();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Virtual for cost variance
materialRequestSchema.virtual('costVariance').get(function() {
  if (this.totalEstimatedCost && this.actualCost) {
    return this.actualCost - this.totalEstimatedCost;
  }
  return 0;
});

// Pre-save middleware to calculate total estimated cost
materialRequestSchema.pre('save', function(next) {
  if (this.materials && this.materials.length > 0) {
    this.totalEstimatedCost = this.materials.reduce((total, material) => {
      return total + (material.estimatedCost || 0);
    }, 0);
  }
  
  // Validate required by date
  if (this.requiredBy && this.requiredBy <= new Date()) {
    return next(new Error('Required by date must be in the future'));
  }
  
  next();
});

// Static method to find requests by project
materialRequestSchema.statics.findByProject = function(projectId) {
  return this.find({ project: projectId })
    .populate('project requestedBy assignedVendors.vendor assignedVendors.assignedBy');
};

// Static method to find requests by vendor
materialRequestSchema.statics.findByVendor = function(vendorId) {
  return this.find({ 'assignedVendors.vendor': vendorId })
    .populate('project requestedBy assignedVendors.vendor assignedVendors.assignedBy');
};

// Static method to find pending requests
materialRequestSchema.statics.findPending = function() {
  return this.find({ status: 'pending' })
    .populate('project requestedBy assignedVendors.vendor');
};

// Instance method to assign vendor
materialRequestSchema.methods.assignVendor = function(vendorId, assignedBy) {
  // Check if vendor is already assigned
  const existingAssignment = this.assignedVendors.find(
    assignment => assignment.vendor.toString() === vendorId.toString()
  );
  
  if (!existingAssignment) {
    this.assignedVendors.push({
      vendor: vendorId,
      assignedBy: assignedBy,
    });
  }
  
  return this.save();
};

// Instance method to approve request
materialRequestSchema.methods.approve = function(approvedBy, comments = '') {
  this.approvals.push({
    approvedBy,
    status: 'approved',
    comments,
  });
  this.status = 'approved';
  return this.save();
};

// Instance method to reject request
materialRequestSchema.methods.reject = function(rejectedBy, comments = '') {
  this.approvals.push({
    approvedBy: rejectedBy,
    status: 'rejected',
    comments,
  });
  this.status = 'rejected';
  return this.save();
};

// Instance method to add note
materialRequestSchema.methods.addNote = function(content, author) {
  this.notes.push({
    content,
    author,
  });
  return this.save();
};

module.exports = mongoose.model('MaterialRequest', materialRequestSchema);
