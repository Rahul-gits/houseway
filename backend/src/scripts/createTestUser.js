const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Database connection
const connectDB = async () => {
  try {
    // Try to connect to MongoDB Atlas first
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/houseway_db');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB Atlas connection error:', error.message);
    console.log('🔄 Attempting to connect to local MongoDB...');
    
    try {
      // Fallback to local MongoDB
      await mongoose.connect('mongodb://localhost:27017/houseway_db');
      console.log('✅ Connected to local MongoDB');
    } catch (localError) {
      console.error('❌ Local MongoDB connection error:', localError.message);
      console.log('💡 MongoDB is not available. Please ensure MongoDB is installed and running locally.');
      process.exit(1);
    }
  }
};

// Create test user
const createTestUser = async () => {
  try {
    await connectDB();
    
    // Check if user already exists
    const existingUser = await User.findByEmail('john.doe@example.com');
    if (existingUser) {
      console.log('⚠️  Test user already exists');
      console.log('User ID:', existingUser._id);
      console.log('Role:', existingUser.role);
      await mongoose.connection.close();
      return;
    }
    
    // Create new test user
    const userData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'Password123',
      role: 'client',
      phone: '+1234567890',
      address: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        country: 'USA'
      },
      clientDetails: {
        projectBudget: 50000,
        preferredStyle: 'Modern',
        propertyType: 'Residential',
        timeline: '3-6 months'
      }
    };
    
    const user = new User(userData);
    await user.save();
    
    console.log('✅ Test user created successfully');
    console.log('User ID:', user._id);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    process.exit(1);
  }
};

createTestUser();