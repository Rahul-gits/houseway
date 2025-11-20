const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import models
const User = require('../models/User');
const Project = require('../models/Project');
const MaterialRequest = require('../models/MaterialRequest');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/houseway');
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedFullData = async () => {
  try {
    console.log('🌱 Starting comprehensive data seeding...\n');

    // ==================== USERS ====================
    
    // Vendor User
    let vendor = await User.findOne({ email: 'vendor@test.com' });
    if (!vendor) {
      vendor = await User.create({
        firstName: 'Premium',
        lastName: 'Vendor',
        email: 'vendor@test.com',
        password: 'password123',
        role: 'vendor',
        phone: '+1-555-0100',
        vendorDetails: {
          companyName: 'Premium Materials Co.',
          businessLicense: 'BL-2024-001',
          specialization: ['Flooring', 'Lighting', 'Furniture', 'Paint', 'Hardware'],
          rating: 4.8,
          totalProjects: 24,
        },
        isActive: true,
      });
      console.log('✅ Vendor user created:', vendor.email);
    } else {
      console.log('✅ Vendor user found:', vendor.email);
    }

    // Client User
    let client = await User.findOne({ email: 'client@test.com' });
    if (!client) {
      client = await User.create({
        firstName: 'John',
        lastName: 'Smith',
        email: 'client@test.com',
        password: 'password123',
        role: 'client',
        phone: '+1-555-0200',
        clientDetails: {
          projectBudget: 3000000,
          preferredStyle: 'Modern Luxury',
          propertyType: 'Residential Villa',
          timeline: '12-18 months',
        },
        isActive: true,
      });
      console.log('✅ Client user created:', client.email);
    } else {
      console.log('✅ Client user found:', client.email);
    }

    // ==================== PROJECTS ====================
    
    const projectsData = [
      {
        title: 'Modern Luxury Villa - Beverly Hills',
        description: 'High-end residential villa with modern amenities, infinity pool, home theater, and smart home integration',
        client: client._id,
        createdBy: client._id,
        projectType: 'residential',
        designStyle: 'modern',
        location: {
          address: '123 Luxury Lane',
          city: 'Beverly Hills',
          state: 'CA',
          zipCode: '90210',
          country: 'USA',
          coordinates: { latitude: 34.0736, longitude: -118.4004 },
        },
        budget: {
          estimated: 2500000,
          actual: 1850000,
        },
        timeline: {
          startDate: new Date('2024-01-15'),
          expectedEndDate: new Date('2025-06-30'),
          actualEndDate: null,
        },
        status: 'in-progress',
        priority: 'high',
        specifications: {
          area: 6500,
          areaUnit: 'sqft',
          floors: 2,
          bedrooms: 5,
          bathrooms: 4,
          parking: 3,
        },
        progress: {
          percentage: 72,
          milestones: [
            { 
              name: 'Foundation Complete', 
              status: 'completed',
              targetDate: new Date('2024-02-15'),
              completedDate: new Date('2024-02-20'),
            },
            { 
              name: 'Structural Work', 
              status: 'completed',
              targetDate: new Date('2024-05-10'),
              completedDate: new Date('2024-05-15'),
            },
            { 
              name: 'Interior Design', 
              status: 'in-progress',
              targetDate: new Date('2024-11-30'),
            },
            { 
              name: 'Final Touches', 
              status: 'pending',
              targetDate: new Date('2025-06-15'),
            },
          ],
        },
        documents: [
          { type: 'contract', name: 'Main Contract.pdf', url: '/docs/contract.pdf', uploadedBy: client._id },
          { type: 'design', name: 'Floor Plan.pdf', url: '/docs/blueprint.pdf', uploadedBy: client._id },
        ],
      },
      {
        title: 'Downtown Penthouse Renovation',
        description: 'Complete renovation of 3000 sq ft penthouse with panoramic city views',
        client: client._id,
        createdBy: client._id,
        projectType: 'renovation',
        designStyle: 'contemporary',
        location: {
          address: '456 Downtown Plaza',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90012',
          country: 'USA',
          coordinates: { latitude: 34.0522, longitude: -118.2437 },
        },
        budget: {
          estimated: 850000,
          actual: 620000,
        },
        timeline: {
          startDate: new Date('2024-03-01'),
          expectedEndDate: new Date('2024-12-31'),
        },
        status: 'in-progress',
        priority: 'medium',
        specifications: {
          area: 3000,
          areaUnit: 'sqft',
          floors: 1,
          bedrooms: 3,
          bathrooms: 2,
          parking: 2,
        },
        progress: {
          percentage: 45,
          milestones: [
            { 
              name: 'Demolition', 
              status: 'completed',
              targetDate: new Date('2024-03-10'),
              completedDate: new Date('2024-03-15'),
            },
            { 
              name: 'Electrical & Plumbing', 
              status: 'completed',
              targetDate: new Date('2024-05-15'),
              completedDate: new Date('2024-05-20'),
            },
            { 
              name: 'Interior Work', 
              status: 'in-progress',
              targetDate: new Date('2024-10-30'),
            },
          ],
        },
      },
      {
        title: 'Coastal Beach House',
        description: 'Mediterranean-style beach house with ocean views and sustainable materials',
        client: client._id,
        createdBy: client._id,
        projectType: 'residential',
        designStyle: 'contemporary',
        location: {
          address: '789 Ocean Drive',
          city: 'Malibu',
          state: 'CA',
          zipCode: '90265',
          country: 'USA',
          coordinates: { latitude: 34.0259, longitude: -118.7798 },
        },
        budget: {
          estimated: 1800000,
          actual: 450000,
        },
        timeline: {
          startDate: new Date('2024-06-01'),
          expectedEndDate: new Date('2025-08-31'),
        },
        status: 'in-progress',
        priority: 'medium',
        specifications: {
          area: 4200,
          areaUnit: 'sqft',
          floors: 2,
          bedrooms: 4,
          bathrooms: 3,
          parking: 2,
        },
        progress: {
          percentage: 25,
          milestones: [
            { 
              name: 'Site Preparation', 
              status: 'completed',
              targetDate: new Date('2024-06-10'),
              completedDate: new Date('2024-06-15'),
            },
            { 
              name: 'Foundation', 
              status: 'in-progress',
              targetDate: new Date('2024-08-30'),
            },
          ],
        },
      },
    ];

    const createdProjects = [];
    for (const projData of projectsData) {
      const existing = await Project.findOne({ title: projData.title });
      if (!existing) {
        const project = await Project.create(projData);
        createdProjects.push(project);
        console.log(`✅ Project created: ${project.title}`);
      } else {
        createdProjects.push(existing);
        console.log(`✅ Project found: ${existing.title}`);
      }
    }

    // ==================== MATERIAL REQUESTS ====================
    
    const materialRequestsData = [
      // Project 1 - Beverly Hills Villa
      {
        project: createdProjects[0]._id,
        requestedBy: client._id,
        title: 'Premium Flooring Materials - Living Areas',
        description: 'High-quality flooring materials for main living room, dining area, and master bedroom',
        materials: [
          { 
            name: 'Italian Marble Tiles', 
            description: 'Premium Calacatta Gold marble with polished finish',
            quantity: 500, 
            unit: 'sqft', 
            category: 'tiles',
            specifications: { brand: 'Italian Stone Co.', grade: 'A+', color: 'White/Gold veining', size: '24x24 inch' },
            estimatedCost: 42500,
            priority: 'high',
            requiredBy: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'Hardwood Flooring', 
            description: 'Natural oak hardwood with protective coating',
            quantity: 800, 
            unit: 'sqft', 
            category: 'wood',
            specifications: { brand: 'Premium Woods', grade: 'A', color: 'Natural', model: 'OAK-PRO-2024' },
            estimatedCost: 36000,
            priority: 'high',
            requiredBy: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
          },
        ],
        requiredBy: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        status: 'pending',
        priority: 'high',
        notes: [{ content: 'Required for Phase 2 completion', author: client._id }],
      },
      {
        project: createdProjects[0]._id,
        requestedBy: client._id,
        title: 'Luxury Lighting Fixtures',
        description: 'High-end lighting fixtures for main hall, bedrooms, and outdoor areas',
        materials: [
          { 
            name: 'Crystal Chandelier', 
            description: 'Modern design chandelier with Austrian crystal',
            quantity: 3, 
            unit: 'pcs', 
            category: 'electrical',
            specifications: { brand: 'Luxe Lighting', size: '48 inch diameter', model: 'LC-2024-PRO' },
            estimatedCost: 10500,
            priority: 'medium',
            requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'LED Recessed Lights', 
            description: 'Dimmable LED lights with warm white color temperature',
            quantity: 50, 
            unit: 'pcs', 
            category: 'electrical',
            specifications: { brand: 'EcoLight', color: '3000K Warm White', model: 'DL-300' },
            estimatedCost: 3250,
            priority: 'medium',
            requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'Outdoor Garden Lights', 
            description: 'Weather-resistant LED pathway lights',
            quantity: 20, 
            unit: 'pcs', 
            category: 'electrical',
            specifications: { brand: 'OutdoorPro', model: 'PATH-500', color: 'Bronze finish' },
            estimatedCost: 2000,
            priority: 'low',
            requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        ],
        requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        priority: 'medium',
        notes: [{ content: 'Installation to be coordinated with electrical work', author: client._id }],
      },
      {
        project: createdProjects[0]._id,
        requestedBy: client._id,
        title: 'Designer Furniture Package',
        description: 'Custom furniture for living, dining, and bedroom areas',
        materials: [
          { 
            name: 'Designer Sofa Set', 
            description: 'L-shaped Italian leather sofa with custom color',
            quantity: 2, 
            unit: 'pcs', 
            category: 'other',
            specifications: { brand: 'Italian Living', model: 'LS-800', color: 'Custom Cream' },
            estimatedCost: 17000,
            priority: 'medium',
            requiredBy: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'Dining Table Set', 
            description: 'Carrara marble top dining table with 8 chairs',
            quantity: 1, 
            unit: 'pcs', 
            category: 'other',
            specifications: { brand: 'Artisan Tables', size: 'Seats 8', model: 'DT-Marble-Elite' },
            estimatedCost: 4500,
            priority: 'medium',
            requiredBy: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'Master Bedroom Suite', 
            description: 'King size bed with custom headboard and nightstands',
            quantity: 1, 
            unit: 'pcs', 
            category: 'other',
            specifications: { brand: 'Luxury Sleep', model: 'KING-ELITE', color: 'Walnut' },
            estimatedCost: 8500,
            priority: 'medium',
            requiredBy: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          },
        ],
        requiredBy: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        status: 'approved',
        priority: 'medium',
        notes: [{ content: 'Custom furniture with 12-week lead time', author: client._id }],
      },
      {
        project: createdProjects[0]._id,
        requestedBy: client._id,
        title: 'Premium Paint & Finishing Materials',
        description: 'Interior and exterior paint, primers, and finishing materials',
        materials: [
          { 
            name: 'Interior Premium Paint', 
            description: 'Low-VOC premium interior paint in various colors',
            quantity: 150, 
            unit: 'gallons', 
            category: 'paint',
            specifications: { brand: 'Benjamin Moore', grade: 'Premium', model: 'Aura Interior' },
            estimatedCost: 7500,
            priority: 'high',
            requiredBy: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'Exterior Weather-Resistant Paint', 
            description: 'UV-resistant exterior paint',
            quantity: 100, 
            unit: 'gallons', 
            category: 'paint',
            specifications: { brand: 'Sherwin Williams', grade: 'Premium', model: 'Duration Exterior' },
            estimatedCost: 6000,
            priority: 'high',
            requiredBy: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          },
        ],
        requiredBy: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        status: 'pending',
        priority: 'high',
        notes: [{ content: 'Color swatches to be approved before delivery', author: client._id }],
      },
      // Project 2 - Downtown Penthouse
      {
        project: createdProjects[1]._id,
        requestedBy: client._id,
        title: 'Modern Kitchen Appliances & Fixtures',
        description: 'High-end kitchen appliances and plumbing fixtures',
        materials: [
          { 
            name: 'Built-in Refrigerator', 
            description: '48-inch built-in refrigerator with smart features',
            quantity: 1, 
            unit: 'pcs', 
            category: 'other',
            specifications: { brand: 'Sub-Zero', model: 'BI-48SID', color: 'Stainless Steel' },
            estimatedCost: 12000,
            priority: 'high',
            requiredBy: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'Induction Cooktop', 
            description: '36-inch induction cooktop with 5 burners',
            quantity: 1, 
            unit: 'pcs', 
            category: 'electrical',
            specifications: { brand: 'Wolf', model: 'CI365TB', color: 'Stainless' },
            estimatedCost: 4500,
            priority: 'high',
            requiredBy: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'Kitchen Sink & Faucet', 
            description: 'Undermount sink with professional faucet',
            quantity: 1, 
            unit: 'pcs', 
            category: 'plumbing',
            specifications: { brand: 'Kohler', model: 'K-3821', color: 'Stainless' },
            estimatedCost: 1800,
            priority: 'high',
            requiredBy: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
          },
        ],
        requiredBy: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
        status: 'pending',
        priority: 'high',
        notes: [{ content: 'Appliances must match kitchen design specs', author: client._id }],
      },
      {
        project: createdProjects[1]._id,
        requestedBy: client._id,
        title: 'Luxury Bathroom Fixtures',
        description: 'Premium bathroom fixtures for master and guest bathrooms',
        materials: [
          { 
            name: 'Freestanding Bathtub', 
            description: 'Modern freestanding soaking tub',
            quantity: 2, 
            unit: 'pcs', 
            category: 'plumbing',
            specifications: { brand: 'Victoria + Albert', model: 'Barcelona', color: 'White' },
            estimatedCost: 6000,
            priority: 'medium',
            requiredBy: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'Rain Shower System', 
            description: 'Ceiling-mounted rain shower with hand shower',
            quantity: 3, 
            unit: 'pcs', 
            category: 'plumbing',
            specifications: { brand: 'Hansgrohe', model: 'Raindance', color: 'Chrome' },
            estimatedCost: 4500,
            priority: 'medium',
            requiredBy: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
          },
        ],
        requiredBy: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
        status: 'approved',
        priority: 'medium',
        notes: [{ content: 'Installation requires specialized plumber', author: client._id }],
      },
      // Project 3 - Beach House
      {
        project: createdProjects[2]._id,
        requestedBy: client._id,
        title: 'Outdoor Decking & Materials',
        description: 'Weather-resistant decking and outdoor materials',
        materials: [
          { 
            name: 'Composite Decking Boards', 
            description: 'Premium composite decking boards',
            quantity: 2000, 
            unit: 'sqft', 
            category: 'wood',
            specifications: { brand: 'Trex', grade: 'Premium', color: 'Tiki Torch', model: 'Transcend' },
            estimatedCost: 18000,
            priority: 'high',
            requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'Outdoor Railing System', 
            description: 'Aluminum railing with glass panels',
            quantity: 150, 
            unit: 'feet', 
            category: 'hardware',
            specifications: { brand: 'Trex', model: 'Signature', color: 'Charcoal Black' },
            estimatedCost: 12000,
            priority: 'high',
            requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        ],
        requiredBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        priority: 'high',
        notes: [{ content: 'Must be salt-water resistant', author: client._id }],
      },
      {
        project: createdProjects[2]._id,
        requestedBy: client._id,
        title: 'Sustainable Building Materials',
        description: 'Eco-friendly and sustainable construction materials',
        materials: [
          { 
            name: 'Recycled Steel Beams', 
            description: 'Structural steel beams from recycled materials',
            quantity: 50, 
            unit: 'pcs', 
            category: 'steel',
            specifications: { brand: 'EcoSteel', grade: 'A992', size: 'W12x26' },
            estimatedCost: 15000,
            priority: 'high',
            requiredBy: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          },
          { 
            name: 'Bamboo Flooring', 
            description: 'Sustainable bamboo flooring planks',
            quantity: 1200, 
            unit: 'sqft', 
            category: 'wood',
            specifications: { brand: 'Cali Bamboo', grade: 'Premium', color: 'Natural', model: 'Fossilized' },
            estimatedCost: 8400,
            priority: 'medium',
            requiredBy: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
          },
        ],
        requiredBy: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        status: 'pending',
        priority: 'high',
        notes: [{ content: 'All materials must have sustainability certifications', author: client._id }],
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

    // ==================== SUMMARY ====================
    
    console.log('\n✅ Comprehensive data seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Vendor: ${vendor.email} (${vendor.vendorDetails?.companyName})`);
    console.log(`   - Client: ${client.email} (${client.firstName} ${client.lastName})`);
    console.log(`   - Projects: ${createdProjects.length}`);
    console.log(`   - Material Requests: ${createdRequests.length}`);
    console.log('\n🔑 Login Credentials:');
    console.log('   Vendor: vendor@test.com / password123');
    console.log('   Client: client@test.com / password123');
    console.log('\n📋 Data Breakdown:');
    console.log('   Project 1 (Beverly Hills Villa): 4 material requests');
    console.log('   Project 2 (Downtown Penthouse): 2 material requests');
    console.log('   Project 3 (Coastal Beach House): 2 material requests');
    console.log('\n📝 Note: Vendors can create quotations for all pending material requests.\n');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await seedFullData();
    console.log('✅ Seeding process completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding process failed:', error);
    process.exit(1);
  }
};

main();
