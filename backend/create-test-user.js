const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

async function createTestUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/houseway_db');
    console.log('Connected to MongoDB');

    // Create a test user with known password
    const testUser = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: await bcrypt.hash('test123', 10),
      role: 'client',
      phone: '1234567890',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country'
      }
    };

    // Check if user already exists
    const existingUser = await User.findOne({ email: testUser.email });
    if (existingUser) {
      console.log('✅ Test user already exists:', testUser.email);
      console.log('📧 Email:', testUser.email);
      console.log('🔑 Password: test123');
    } else {
      const newUser = new User(testUser);
      await newUser.save();
      console.log('✅ Test user created successfully!');
      console.log('📧 Email:', testUser.email);
      console.log('🔑 Password: test123');
    }
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestUser();
