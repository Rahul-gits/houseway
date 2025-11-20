const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  materialRequestItem: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  materialName: {
    type: String,
    required: [true, 'Material name is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.01, 'Quantity must be greater than 0'],
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative'],
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0, 'Total price cannot be negative'],
  },
  specifications: {
    brand: String,
    model: String,
    color: String,
    size: String,
    grade: String,
    warranty: String,
    other: String,
  },
  availability: {
    inStock: {
      type: Boolean,
      default: true,
    },
    deliveryTime: {
      type: Number, // in days
      min: [0, 'Delivery time cannot be negative'],
    },
    minimumOrderQuantity: {
      type: Number,
      min: [1, 'Minimum order quantity must be at least 1'],
      default: 1,
    },
  },
});

const quotationSchema = new mongoose.Schema({
  materialRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaterialRequest',
    required: [true, 'Material request is required'],
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Vendor is required'],
  },
  quotationNumber: {
    type: String,
    unique: true,
    trim: true,
  },
  title: {
    type: String,
    required: [true, 'Quotation title is required'],
    trim: true,
    maxlength: [100, 'Quotation title cannot exceed 100 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Quotation description cannot exceed 500 characters'],
  },
  items: {
    type: [quotationItemSchema],
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'At least one quotation item is required',
    },
  },
  subtotal: {
    type: Number,
    min: [0, 'Subtotal cannot be negative'],
    default: 0,
  },
  tax: {
    percentage: {
      type: Number,
      min: [0, 'Tax percentage cannot be negative'],
      max: [100, 'Tax percentage cannot exceed 100'],
      default: 0,
    },
    amount: {
      type: Number,
      min: [0, 'Tax amount cannot be negative'],
      default: 0,
    },
  },
  discount: {
    percentage: {
      type: Number,
      min: [0, 'Discount percentage cannot be negative'],
      max: [100, 'Discount percentage cannot exceed 100'],
      default: 0,
    },
    amount: {
      type: Number,
      min: [0, 'Discount amount cannot be negative'],
      default: 0,
    },
  },
  totalAmount: {
    type: Number,
    min: [0, 'Total amount cannot be negative'],
    default: 0,
  },
  currency: {
    type: String,
    default: 'USD',
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'expired'],
      message: 'Status must be one of: draft, submitted, under_review, approved, rejected, expired',
    },
    default: 'draft',
  },
  validUntil: {
    type: Date,
    required: [true, 'Valid until date is required'],
  },
  deliveryTerms: {
    deliveryTime: {
      type: Number, // in days
      required: [true, 'Delivery time is required'],
      min: [1, 'Delivery time must be at least 1 day'],
    },
    deliveryLocation: {
      type: String,
      required: [true, 'Delivery location is required'],
      trim: true,
    },
    deliveryCharges: {
      type: Number,
      min: [0, 'Delivery charges cannot be negative'],
      default: 0,
    },
    freeDeliveryThreshold: {
      type: Number,
      min: [0, 'Free delivery threshold cannot be negative'],
    },
  },
  paymentTerms: {
    paymentMethod: {
      type: String,
      enum: {
        values: ['cash', 'check', 'bank_transfer', 'credit_card', 'net_30', 'net_60', 'advance'],
        message: 'Payment method must be one of: cash, check, bank_transfer, credit_card, net_30, net_60, advance',
      },
      required: [true, 'Payment method is required'],
    },
    advancePercentage: {
      type: Number,
      min: [0, 'Advance percentage cannot be negative'],
      max: [100, 'Advance percentage cannot exceed 100'],
      default: 0,
    },
    creditDays: {
      type: Number,
      min: [0, 'Credit days cannot be negative'],
      default: 0,
    },
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
      enum: ['pdf', 'excel', 'image', 'other'],
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  reviews: [{
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['approved', 'rejected', 'needs_revision'],
      required: true,
    },
    comments: {
      type: String,
      maxlength: [500, 'Review comments cannot exceed 500 characters'],
    },
    rating: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
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
    isInternal: {
      type: Boolean,
      default: false,
    },
  }],
  submittedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance (quotationNumber index is already created by unique: true)
quotationSchema.index({ materialRequest: 1 });
quotationSchema.index({ vendor: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ validUntil: 1 });
quotationSchema.index({ createdAt: -1 });

// Virtual for days until expiry
quotationSchema.virtual('daysUntilExpiry').get(function() {
  if (this.validUntil) {
    const diffTime = this.validUntil - new Date();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Virtual for average rating
quotationSchema.virtual('averageRating').get(function() {
  if (this.reviews && this.reviews.length > 0) {
    const ratingsWithValues = this.reviews.filter(review => review.rating);
    if (ratingsWithValues.length > 0) {
      const sum = ratingsWithValues.reduce((total, review) => total + review.rating, 0);
      return Math.round((sum / ratingsWithValues.length) * 10) / 10;
    }
  }
  return null;
});

// Pre-save middleware to calculate totals and generate quotation number
quotationSchema.pre('save', function(next) {
  // Calculate subtotal
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((total, item) => {
      item.totalPrice = item.quantity * item.unitPrice;
      return total + item.totalPrice;
    }, 0);
  }
  
  // Calculate tax amount
  if (this.tax.percentage > 0) {
    this.tax.amount = (this.subtotal * this.tax.percentage) / 100;
  }
  
  // Calculate discount amount
  if (this.discount.percentage > 0) {
    this.discount.amount = (this.subtotal * this.discount.percentage) / 100;
  }
  
  // Calculate total amount
  this.totalAmount = this.subtotal + this.tax.amount - this.discount.amount + this.deliveryTerms.deliveryCharges;
  
  // Generate quotation number if not provided
  if (!this.quotationNumber) {
    const timestamp = Date.now().toString().slice(-6);
    this.quotationNumber = `QUO-${timestamp}`;
  }
  
  // Validate expiry date
  if (this.validUntil && this.validUntil <= new Date()) {
    return next(new Error('Valid until date must be in the future'));
  }
  
  next();
});

// Static method to find quotations by material request
quotationSchema.statics.findByMaterialRequest = function(materialRequestId) {
  return this.find({ materialRequest: materialRequestId })
    .populate('materialRequest vendor reviews.reviewedBy');
};

// Static method to find quotations by vendor
quotationSchema.statics.findByVendor = function(vendorId) {
  return this.find({ vendor: vendorId })
    .populate('materialRequest vendor reviews.reviewedBy');
};

// Static method to find pending quotations
quotationSchema.statics.findPending = function() {
  return this.find({ status: 'submitted' })
    .populate('materialRequest vendor');
};

// Instance method to submit quotation
quotationSchema.methods.submit = function() {
  this.status = 'submitted';
  this.submittedAt = new Date();
  return this.save();
};

// Instance method to approve quotation
quotationSchema.methods.approve = function(approvedBy, comments = '', rating = null) {
  this.reviews.push({
    reviewedBy: approvedBy,
    status: 'approved',
    comments,
    rating,
  });
  this.status = 'approved';
  return this.save();
};

// Instance method to reject quotation
quotationSchema.methods.reject = function(rejectedBy, comments = '') {
  this.reviews.push({
    reviewedBy: rejectedBy,
    status: 'rejected',
    comments,
  });
  this.status = 'rejected';
  return this.save();
};

module.exports = mongoose.model('Quotation', quotationSchema);
