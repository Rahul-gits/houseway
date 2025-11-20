const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    unique: true,
    default: function() {
      // Auto-generate INV-YYYY-MM-XXXX format
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `INV-${year}-${month}-${random}`;
    }
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required']
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Client is required']
  },
  issueDate: {
    type: Date,
    required: [true, 'Issue date is required'],
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    validate: {
      validator: function(value) {
        return value > this.issueDate;
      },
      message: 'Due date must be after issue date'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
      message: 'Status must be one of: draft, sent, paid, overdue, cancelled'
    },
    default: 'draft'
  },
  items: [{
    description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true,
      maxlength: [200, 'Item description cannot exceed 200 characters']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative']
    },
    total: {
      type: Number,
      min: [0, 'Item total cannot be negative']
    }
  }],
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  },
  tax: {
    rate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100']
    },
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Tax amount cannot be negative']
    }
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  total: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
    minlength: [3, 'Currency code must be 3 characters'],
    maxlength: [3, 'Currency code must be 3 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  paymentTerms: {
    type: String,
    default: 'Net 30',
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator information is required']
  },
  paidDate: Date,
  paidAmount: {
    type: Number,
    min: [0, 'Paid amount cannot be negative'],
    default: 0
  }
}, {
  timestamps: true,
});

// Indexes for better query performance
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ client: 1 });
invoiceSchema.index({ project: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ issueDate: -1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ createdBy: 1 });

// Virtual for formatted invoice number
invoiceSchema.virtual('formattedInvoiceNumber').get(function() {
  return this.invoiceNumber.toUpperCase();
});

// Virtual for amount due
invoiceSchema.virtual('amountDue').get(function() {
  return this.total - this.paidAmount;
});

// Virtual for formatted currency amounts
invoiceSchema.virtual('formattedTotal').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency
  }).format(this.total);
});

// Virtual for is overdue
invoiceSchema.virtual('isOverdue').get(function() {
  return this.status === 'sent' && new Date() > this.dueDate;
});

// Pre-save middleware to calculate totals
invoiceSchema.pre('save', function(next) {
  // Calculate item totals and subtotal
  let subtotal = 0;
  this.items.forEach(item => {
    item.total = item.quantity * item.unitPrice;
    subtotal += item.total;
  });
  this.subtotal = subtotal;

  // Calculate tax amount
  this.tax.amount = (this.subtotal - this.discount) * (this.tax.rate / 100);

  // Calculate total
  this.total = this.subtotal - this.discount + this.tax.amount;

  // Check for overdue status
  if (this.status === 'sent' && new Date() > this.dueDate) {
    this.status = 'overdue';
  }

  next();
});

// Static method to find invoices by client
invoiceSchema.statics.findByClient = function(clientId) {
  return this.find({ client: clientId })
    .populate('project', 'title')
    .populate('createdBy', 'firstName lastName')
    .sort({ issueDate: -1 });
};

// Static method to find invoices by project
invoiceSchema.statics.findByProject = function(projectId) {
  return this.find({ project: projectId })
    .populate('client', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName')
    .sort({ issueDate: -1 });
};

// Static method to find overdue invoices
invoiceSchema.statics.findOverdue = function() {
  return this.find({
    status: 'sent',
    dueDate: { $lt: new Date() }
  })
    .populate('client', 'firstName lastName email')
    .populate('project', 'title')
    .sort({ dueDate: 1 });
};

// Static method to get invoice statistics
invoiceSchema.statics.getStats = function(startDate = null, endDate = null) {
  const matchStage = {};
  if (startDate || endDate) {
    matchStage.issueDate = {};
    if (startDate) matchStage.issueDate.$gte = startDate;
    if (endDate) matchStage.issueDate.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$total' }
      }
    }
  ]);
};

// Instance method to add item
invoiceSchema.methods.addItem = function(description, quantity, unitPrice) {
  this.items.push({
    description,
    quantity,
    unitPrice
  });
  return this.save();
};

// Instance method to remove item
invoiceSchema.methods.removeItem = function(index) {
  if (index >= 0 && index < this.items.length) {
    this.items.splice(index, 1);
  }
  return this.save();
};

// Instance method to mark as paid
invoiceSchema.methods.markAsPaid = function(paidAmount = null) {
  this.status = 'paid';
  this.paidDate = new Date();
  this.paidAmount = paidAmount || this.total;
  return this.save();
};

// Instance method to send invoice
invoiceSchema.methods.send = function() {
  if (this.status === 'draft') {
    this.status = 'sent';
    return this.save();
  }
  return Promise.resolve(this);
};

module.exports = mongoose.model('Invoice', invoiceSchema);