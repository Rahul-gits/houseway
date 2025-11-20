const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
} = require('../controllers/authController');

const {
  validateRegistration,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange,
} = require('../middleware/validation');

const { authenticate, isOwner } = require('../middleware/auth');
const { uploadSingle, getFileUrl } = require('../middleware/upload');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public for clients/guests, Protected for owner/employee/vendor
 */
router.post('/register', validateRegistration, register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validateLogin, login);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, validateProfileUpdate, updateProfile);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', authenticate, validatePasswordChange, changePassword);

/**
 * @route   POST /api/auth/register-employee
 * @desc    Register a new employee (Owner only)
 * @access  Private (Owner only)
 */
router.post('/register-employee', authenticate, isOwner, (req, res, next) => {
  req.body.role = 'employee';
  next();
}, validateRegistration, register);

/**
 * @route   POST /api/auth/register-vendor
 * @desc    Register a new vendor (Owner only)
 * @access  Private (Owner only)
 */
router.post('/register-vendor', authenticate, isOwner, (req, res, next) => {
  req.body.role = 'vendor';
  next();
}, validateRegistration, register);

/**
 * @route   POST /api/auth/register-client
 * @desc    Register a new client
 * @access  Public
 */
router.post('/register-client', (req, res, next) => {
  req.body.role = 'client';
  next();
}, validateRegistration, register);

/**
 * @route   POST /api/auth/register-guest
 * @desc    Register a new guest
 * @access  Public
 */
router.post('/register-guest', (req, res, next) => {
  req.body.role = 'guest';
  next();
}, validateRegistration, register);

/**
 * @route   POST /api/auth/upload-profile-photo
 * @desc    Upload profile photo
 * @access  Private
 */
router.post('/upload-profile-photo', authenticate, uploadSingle('profilePhoto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Check if file is an image
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed',
      });
    }

    const User = require('../models/User');

    // Get the file URL
    const profileImageUrl = getFileUrl(req, `images/${req.file.filename}`);

    // Update user profile with new image URL
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: profileImageUrl },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        profileImage: profileImageUrl,
        user: user.toSafeObject(),
      },
    });
  } catch (error) {
    console.error('Profile photo upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo',
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/auth/remove-profile-photo
 * @desc    Remove profile photo
 * @access  Private
 */
router.delete('/remove-profile-photo', authenticate, async (req, res) => {
  try {
    const User = require('../models/User');

    // Update user profile to remove image
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $unset: { profileImage: 1 } },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'Profile photo removed successfully',
      data: {
        user: user.toSafeObject(),
      },
    });
  } catch (error) {
    console.error('Profile photo removal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove profile photo',
      error: error.message,
    });
  }
});

module.exports = router;
