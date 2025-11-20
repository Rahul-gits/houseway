const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

async function resetTestUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/houseway_db');
    console.log('Connected to MongoDB');

    // Delete existing test user if exists
    await User.deleteOne({ email: 'test@example.com' });
    console.log('Deleted existing test user (if any)');

    // Create a fresh test user with plain password (let the model hash it)
    console.log('Creating user with plain password (model will hash it)');

    const testUser = new User({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'test123', // Plain password - the pre-save hook will hash it
      role: 'client',
      phone: '1234567890',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country'
      }
    });

    await testUser.save();
    console.log('✅ Fresh test user created successfully!');
    console.log('📧 Email: test@example.com');
    console.log('🔑 Password: test123');
    console.log('👤 User ID:', testUser._id);

    // Verify the user can be found
    const foundUser = await User.findOne({ email: 'test@example.com' });
    if (foundUser) {
      console.log('✅ User verification successful');
      
      // Test password comparison using the model method
      const isPasswordValid = await foundUser.comparePassword('test123');
      console.log('🔐 Password validation:', isPasswordValid ? '✅ Valid' : '❌ Invalid');
    } else {
      console.log('❌ User verification failed');
    }
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetTestUser();
