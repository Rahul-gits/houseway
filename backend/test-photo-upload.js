const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5001/api';

// Test photo upload functionality
async function testPhotoUpload() {
  try {
    console.log('🧪 Testing Profile Photo Upload Functionality\n');

    // Step 1: Login to get authentication token
    console.log('1. Logging in as test user...');

    // Use the test user we created
    const testCredentials = [
      { email: 'test@example.com', password: 'test123' }
    ];

    let loginResponse = null;
    let credentials = null;

    for (const cred of testCredentials) {
      try {
        console.log(`   Trying ${cred.email}...`);
        loginResponse = await axios.post(`${BASE_URL}/auth/login`, cred);
        if (loginResponse.data.success) {
          credentials = cred;
          break;
        }
      } catch (error) {
        // Continue to next credential
        continue;
      }
    }

    if (!loginResponse || !loginResponse.data.success) {
      console.log('❌ Login failed for all test credentials');
      console.log('Available users: webuser@example.com, john.doe@example.com, jane.smith@example.com');
      console.log('Please check user passwords or create a test user manually');
      return;
    }

    console.log(`✅ Login successful with: ${credentials.email}`);

    const token = loginResponse.data.data.token;
    const user = loginResponse.data.data.user;
    console.log('✅ Login successful for:', user.firstName, user.lastName);

    // Step 2: Test photo upload endpoint
    console.log('\n2. Testing photo upload endpoint...');
    
    // Create a simple test image file (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
      0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    // Create FormData
    const formData = new FormData();
    formData.append('profilePhoto', testImageBuffer, {
      filename: 'test-profile.png',
      contentType: 'image/png'
    });

    // Upload photo
    const uploadResponse = await axios.post(`${BASE_URL}/auth/upload-profile-photo`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      }
    });

    if (uploadResponse.data.success) {
      console.log('✅ Photo upload successful!');
      console.log('📸 Profile image URL:', uploadResponse.data.data.profileImage);
      console.log('👤 Updated user data:', {
        id: uploadResponse.data.data.user._id,
        name: `${uploadResponse.data.data.user.firstName} ${uploadResponse.data.data.user.lastName}`,
        profileImage: uploadResponse.data.data.user.profileImage
      });
    } else {
      console.log('❌ Photo upload failed:', uploadResponse.data.message);
    }

    // Step 3: Test photo removal
    console.log('\n3. Testing photo removal...');
    const removeResponse = await axios.delete(`${BASE_URL}/auth/remove-profile-photo`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (removeResponse.data.success) {
      console.log('✅ Photo removal successful!');
      console.log('👤 Updated user (no photo):', {
        id: removeResponse.data.data.user._id,
        name: `${removeResponse.data.data.user.firstName} ${removeResponse.data.data.user.lastName}`,
        profileImage: removeResponse.data.data.user.profileImage || 'null'
      });
    } else {
      console.log('❌ Photo removal failed:', removeResponse.data.message);
    }

    console.log('\n🎉 Photo upload functionality test completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

// Run the test
testPhotoUpload();
