const mongoose = require('mongoose');

const workStatusSchema = new mongoose.Schema({
  quotation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation',
    required: [true, 'Quotation is required'],
  },
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
  message: {
    type: String,
    required: [true, 'Status message is required'],
    trim: true,
  },
  progress: {
    type: Number,
    min: [0, 'Progress cannot be less than 0'],
    max: [100, 'Progress cannot be more than 100'],
    default: 0,
  },
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
  }],
}, {
  timestamps: true,
});

// Indexes for faster queries
workStatusSchema.index({ quotation: 1, createdAt: -1 });
workStatusSchema.index({ materialRequest: 1, createdAt: -1 });
workStatusSchema.index({ vendor: 1, createdAt: -1 });

module.exports = mongoose.model('WorkStatus', workStatusSchema);
