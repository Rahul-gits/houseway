const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const { authenticate, authorize } = require('../middleware/auth');
const { deleteFile } = require('../middleware/upload');
const File = require('../models/File');

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create category directory if it doesn't exist
    const category = req.body.category || 'documents';
    const allowedCategories = ['documents', 'images', 'quotations', 'purchase-orders', 'work_update'];
    const uploadDir = path.join(__dirname, '../../uploads', category);
    
    console.log('[Files] Multer destination - category:', category, 'uploadDir:', uploadDir);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = file.fieldname + '-' + uniqueSuffix + ext;
    console.log('[Files] Multer filename - original:', file.originalname, 'generated:', filename);
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/quicktime',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    console.log('[Files] Multer fileFilter - file mimetype:', file.mimetype);
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, Word documents, and text files are allowed.'));
    }
  }
});

/**
 * @route   POST /api/files/upload
 * @desc    Upload a file
 * @access  Private
 */
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    console.log('[Files] Upload request received:', {
      file: req.file,
      body: req.body,
      headers: req.headers,
      files: req.files  // Check if files are in a different property
    });
    
    // Also log raw request info
    console.log('[Files] Request method:', req.method);
    console.log('[Files] Request URL:', req.url);
    console.log('[Files] Content-Type header:', req.headers['content-type']);
    
    if (!req.file) {
      console.log('[Files] No file found in request. Checking multer...');
      
      // Log multer error if exists
      if (req.multerError) {
        console.log('[Files] Multer error:', req.multerError);
      }
      
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Create file record in database
    const fileData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      category: req.body.category || 'documents',
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploadedBy: req.user._id,
      tags: req.body.tags ? JSON.parse(req.body.tags) : [],
    };

    // Add project ID if provided
    if (req.body.projectId) {
      fileData.project = req.body.projectId;
      console.log('[Files] Associating file with project:', req.body.projectId);
    }

    const file = new File(fileData);

    await file.save();
    await file.populate('uploadedBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: { file },
    });
  } catch (error) {
    console.error('File upload error:', error);
    
    // Delete uploaded file if database save failed
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/files/project/:projectId
 * @desc    Get files by project ID
 * @access  Private (role-based)
 */
router.get('/project/:projectId', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Validate projectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID',
      });
    }
    
    console.log('[Files] Fetching files for project:', projectId);
    
    // TODO: Add proper access control based on project ownership
    // For now, any authenticated user can access project files
    
    const files = await File.find({ project: projectId })
      .populate('uploadedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    console.log('[Files] Found files:', files.length);
    
    // Add URL information to each file
    const filesWithUrls = files.map(file => {
      // Extract category and filename from path
      const pathParts = file.path.split('/');
      const category = pathParts[pathParts.length - 2];
      const filename = pathParts[pathParts.length - 1];
      
      // Log for debugging
      console.log('[Files] Processing file:', { 
        id: file._id, 
        category, 
        filename, 
        path: file.path,
        project: file.project
      });
      
      return {
        ...file.toObject(),
        url: `/api/files/${category}/${filename}`,
        downloadUrl: `/api/files/${category}/${filename}`,
      };
    });
    
    res.json({
      success: true,
      data: { files: filesWithUrls },
    });
  } catch (error) {
    console.error('Get project files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get project files',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/files/:category/:filename
 * @desc    Download/view file
 * @access  Private (role-based)
 */
router.get('/:category/:filename', authenticate, async (req, res) => {
  try {
    const { category, filename } = req.params;
    
    // Validate category
    const allowedCategories = ['documents', 'images', 'quotations', 'purchase-orders', 'work_update'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file category',
      });
    }
    
    const filePath = path.join(__dirname, '../../uploads', category, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }
    
    // TODO: Add proper access control based on file ownership/project access
    // For now, any authenticated user can access files
    
    // Set appropriate headers
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.doc':
        contentType = 'application/msword';
        break;
      case '.docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case '.xls':
        contentType = 'application/vnd.ms-excel';
        break;
      case '.xlsx':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/files/:category/:filename
 * @desc    Delete file
 * @access  Private (Owner only or file uploader)
 */
router.delete('/:category/:filename', authenticate, async (req, res) => {
  try {
    const { category, filename } = req.params;
    
    // Validate category
    const allowedCategories = ['documents', 'images', 'quotations', 'purchase-orders', 'work_update'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file category',
      });
    }
    
    // Only owners can delete files for now
    // TODO: Add proper access control based on file ownership
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only owners can delete files',
      });
    }
    
    const filePath = path.join(__dirname, '../../uploads', category, filename);
    
    const deleted = deleteFile(filePath);
    
    if (deleted) {
      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found or could not be deleted',
      });
    }
    
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/files/info/:category/:filename
 * @desc    Get file information
 * @access  Private
 */
router.get('/info/:category/:filename', authenticate, async (req, res) => {
  try {
    const { category, filename } = req.params;
    
    // Validate category
    const allowedCategories = ['documents', 'images', 'quotations', 'purchase-orders', 'work_update'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file category',
      });
    }
    
    const filePath = path.join(__dirname, '../../uploads', category, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    const fileInfo = {
      filename,
      category,
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      extension: ext,
      created: stats.birthtime,
      modified: stats.mtime,
      isImage: ['.jpg', '.jpeg', '.png', '.gif'].includes(ext),
      isPDF: ext === '.pdf',
      isDocument: ['.doc', '.docx', '.xls', '.xlsx', '.txt'].includes(ext),
    };
    
    res.json({
      success: true,
      data: { fileInfo },
    });
    
  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file information',
      error: error.message,
    });
  }
});

/**
 * Helper function to format file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;
