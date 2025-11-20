const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import models
const User = require('../models/User');
const Project = require('../models/Project');
const MaterialRequest = require('../models/MaterialRequest');
const Quotation = require('../models/Quotation');
const PurchaseOrder = require('../models/PurchaseOrder');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/houseway_db', {
      // Remove deprecated options
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedVendorData = async () => {
  try {
    console.log('🌱 Starting vendor data seeding...\n');

    // Find or create vendor user
    let vendor = await User.findOne({ email: 'vendor@test.com' });
    if (!vendor) {
      vendor = await User.create({
        firstName: 'Test',
        lastName: 'Vendor',
        email: 'vendor@test.com',
        password: 'password123',
        role: 'vendor',
        phone: '+1-555-0123',
        vendorDetails: {
          companyName: 'Premium Materials Co.',
          specialization: ['Flooring', 'Lighting', 'Furniture'],
          rating: 4.8,
          totalProjects: 15,
        },
        isActive: true,
      });
      console.log('✅ Vendor user created:', vendor.email);
    } else {
      console.log('✅ Vendor user found:', vendor.email);
    }

    // Find or create client user
    let client = await User.findOne({ email: 'client@test.com' });
    if (!client) {
      client = await User.create({
        firstName: 'Test',
        lastName: 'Client',
        email: 'client@test.com',
        password: 'password123',
        role: 'client',
        phone: '+1-555-0456',
        isActive: true,
      });
      console.log('✅ Client user created:', client.email);
    } else {
      console.log('✅ Client user found:', client.email);
    }

    // Find or create test project
    let project = await Project.findOne({ title: 'Modern Luxury Villa - Beverly Hills' });
    if (!project) {
      project = await Project.create({
        title: 'Modern Luxury Villa - Beverly Hills',
        description: 'High-end residential villa with modern amenities',
        client: client._id,
        createdBy: client._id,
        projectType: 'residential',
        location: {
          address: '123 Luxury Lane',
          city: 'Beverly Hills',
          state: 'CA',
          zipCode: '90210',
          country: 'USA',
        },
        budget: {
          estimated: 2500000,
          actual: 1800000,
        },
        timeline: {
          startDate: new Date('2024-01-15'),
          expectedEndDate: new Date('2025-06-30'),
        },
        status: 'in-progress',
        progress: {
          percentage: 72,
          milestones: [
            { name: 'Foundation Complete', completed: true },
            { name: 'Structural Work', completed: true },
            { name: 'Interior Design', completed: false },
          ],
        },
      });
      console.log('✅ Project created:', project.title);
    } else {
      console.log('✅ Project found:', project.title);
    }

    // Create Material Requests
    const materialRequestsData = [
      {
        project: project._id,
        requestedBy: client._id,
        title: 'Flooring Materials for Living Room and Master Bedroom',
        description: 'High-quality flooring materials needed for the main living areas',
        materials: [
          { 
            name: 'Italian Marble Tiles', 
            description: 'Premium Calacatta Gold marble with polished finish',
            quantity: 500, 
            unit: 'sqft', 
            category: 'tiles',
            specifications: { brand: 'Italian Stone Co.', grade: 'A+', color: 'White/Gold veining' },
            estimatedCost: 85,
            priority: 'high',
            requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'Hardwood Flooring', 
            description: 'Natural oak hardwood with protective coating',
            quantity: 800, 
            unit: 'sqft', 
            category: 'wood',
            specifications: { brand: 'Premium Woods', grade: 'A', color: 'Natural' },
            estimatedCost: 45,
            priority: 'high',
            requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        ],
        requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        priority: 'high',
        notes: [
          {
            content: 'Required for living room and master bedroom',
            author: client._id,
          }
        ],
      },
      {
        project: project._id,
        requestedBy: client._id,
        title: 'Lighting Fixtures for Main Hall and Bedrooms',
        description: 'Modern lighting fixtures with energy-efficient LED technology',
        materials: [
          { 
            name: 'Crystal Chandelier', 
            description: 'Modern design chandelier with Austrian crystal',
            quantity: 3, 
            unit: 'pcs', 
            category: 'electrical',
            specifications: { brand: 'Luxe Lighting', size: '48 inch diameter', model: 'LC-2024' },
            estimatedCost: 3500,
            priority: 'medium',
            requiredBy: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'LED Recessed Lights', 
            description: 'Dimmable LED lights with warm white color temperature',
            quantity: 50, 
            unit: 'pcs', 
            category: 'electrical',
            specifications: { brand: 'EcoLight', color: '3000K Warm White', model: 'DL-300' },
            estimatedCost: 65,
            priority: 'medium',
            requiredBy: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          },
        ],
        requiredBy: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        status: 'pending',
        priority: 'medium',
        notes: [
          {
            content: 'For main hall and bedrooms',
            author: client._id,
          }
        ],
      },
      {
        project: project._id,
        requestedBy: client._id,
        title: 'Custom Furniture for Living and Dining Areas',
        description: 'High-end designer furniture with premium materials',
        materials: [
          { 
            name: 'Designer Sofa Set', 
            description: 'L-shaped Italian leather sofa with custom color options',
            quantity: 2, 
            unit: 'pcs', 
            category: 'other',
            specifications: { brand: 'Italian Living', model: 'LS-800', color: 'Custom' },
            estimatedCost: 8500,
            priority: 'medium',
            requiredBy: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'Dining Table', 
            description: 'Carrara marble top with solid wood base',
            quantity: 1, 
            unit: 'pcs', 
            category: 'other',
            specifications: { brand: 'Artisan Tables', size: 'Seats 8', model: 'DT-Marble' },
            estimatedCost: 4500,
            priority: 'medium',
            requiredBy: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          },
        ],
        requiredBy: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        status: 'approved',
        priority: 'medium',
        notes: [
          {
            content: 'Custom made furniture for living and dining areas',
            author: client._id,
          }
        ],
      },
    ];

    const createdRequests = [];
    for (const reqData of materialRequestsData) {
      const existing = await MaterialRequest.findOne({
        project: reqData.project,
        title: reqData.title,
      });
      
      if (!existing) {
        const request = await MaterialRequest.create(reqData);
        createdRequests.push(request);
        console.log(`✅ Material request created: ${request.title}`);
      } else {
        createdRequests.push(existing);
        console.log(`✅ Material request found: ${existing.title}`);
      }
    }

    console.log('\n✅ Vendor data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Vendor: ${vendor.email} (${vendor.vendorDetails?.companyName || 'N/A'})`);
    console.log(`   - Client: ${client.email}`);
    console.log(`   - Project: ${project.title}`);
    console.log(`   - Material Requests: ${createdRequests.length}`);
    console.log('\n🔑 Login credentials:');
    console.log('   Vendor: vendor@test.com / password123');
    console.log('   Client: client@test.com / password123\n');
    console.log('\n📝 Note: Vendors can now create quotations for the material requests through the UI.\n');

  } catch (error) {
    console.error('❌ Error seeding vendor data:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await seedVendorData();
    console.log('✅ Seeding process completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding process failed:', error);
    process.exit(1);
  }
};

main();
