require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const MaterialRequest = require('../src/models/MaterialRequest');
const Quotation = require('../src/models/Quotation');

const seedApprovedQuotation = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/houseway_db');
    console.log('✅ Connected to MongoDB');

    // Find vendor
    const vendor = await User.findOne({ email: 'vendor@test.com' });
    if (!vendor) {
      console.log('❌ Vendor not found. Please run main seed script first.');
      process.exit(1);
    }

    // Find client
    const client = await User.findOne({ email: 'client@test.com' });
    if (!client) {
      console.log('❌ Client not found. Please run main seed script first.');
      process.exit(1);
    }

    // Find employee (use existing one)
    let employee = await User.findOne({ role: 'employee' });
    if (!employee) {
      console.log('❌ No employee found in database');
      process.exit(1);
    }
    console.log(`✅ Using employee: ${employee.email}`);

    // Find or create a project
    let project = await Project.findOne({ client: client._id });
    if (!project) {
      project = new Project({
        title: 'Test Construction Project',
        client: client._id,
        status: 'in_progress',
        budget: 500000,
        location: {
          address: '123 Main St, Test City, TC 12345',
          coordinates: {
            latitude: 40.7128,
            longitude: -74.0060,
          },
        },
        startDate: new Date(),
        endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      });
      await project.save();
      console.log('✅ Created test project');
    }

    // Create material request
    const materialRequest = new MaterialRequest({
      project: project._id,
      client: client._id,
      requestedBy: client._id,
      title: 'Construction Materials for Foundation',
      description: 'High-quality materials needed for foundation work',
      materials: [
        {
          name: 'Portland Cement',
          description: 'Type I Portland Cement',
          category: 'cement',
          quantity: 100,
          unit: 'pcs',
          requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          specifications: {
            brand: 'Premium Brand',
            grade: 'Type I',
          },
        },
        {
          name: 'Steel Rebar',
          description: '12mm steel reinforcement bars',
          category: 'steel',
          quantity: 500,
          unit: 'pcs',
          requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          specifications: {
            diameter: '12mm',
            length: '6m',
          },
        },
      ],
      priority: 'high',
      requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'approved',
      assignedVendor: vendor._id,
    });
    await materialRequest.save();
    console.log('✅ Created material request');

    // Create quotation
    const quotation = new Quotation({
      materialRequest: materialRequest._id,
      vendor: vendor._id,
      title: `Quotation for ${materialRequest.title}`,
      description: materialRequest.description,
      items: materialRequest.materials.map(material => ({
        materialRequestItem: material._id,
        materialName: material.name,
        description: material.description,
        quantity: material.quantity,
        unit: material.unit,
        unitPrice: 50.00,
        totalPrice: material.quantity * 50.00,
        specifications: material.specifications ? 
          Object.entries(material.specifications)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ') : '',
      })),
      tax: {
        percentage: 0,
        amount: 0,
      },
      discount: {
        percentage: 0,
        amount: 0,
      },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      deliveryTerms: {
        deliveryTime: 14,
        deliveryLocation: project.location.address,
        deliveryCharges: 0,
      },
      paymentTerms: {
        paymentMethod: 'net_30',
        advancePercentage: 30,
        creditDays: 30,
      },
      status: 'approved',
    });
    
    await quotation.save();
    console.log('✅ Created quotation');

    // Approve the quotation
    quotation.reviews.push({
      reviewedBy: employee._id,
      status: 'approved',
      comments: 'Quotation approved for work to begin',
      rating: 5,
    });
    await quotation.save();
    console.log('✅ Approved quotation');

    console.log('\n📊 Test Data Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Project: ${project.title}`);
    console.log(`Material Request: ${materialRequest.title}`);
    console.log(`Quotation ID: ${quotation._id}`);
    console.log(`Status: ${quotation.status}`);
    console.log(`Total Amount: $${quotation.totalAmount.toFixed(2)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Seed completed successfully!');
    console.log('📱 Login as vendor@test.com to test work status upload');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedApprovedQuotation();
