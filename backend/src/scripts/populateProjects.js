const mongoose = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');
const sampleProjects = require('../utils/sampleProjects');
require('dotenv').config();

const populateProjects = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/houseway');
    console.log('Connected to MongoDB');

    // Clear existing projects (optional - comment out if you want to keep existing data)
    // await Project.deleteMany({});
    // console.log('Cleared existing projects');

    // Find existing users to assign as clients
    const users = await User.find({ role: 'client' }).limit(5);
    if (users.length === 0) {
      console.log('No client users found. Creating sample clients...');
      
      // Create sample client users
      const sampleClients = [
        {
          firstName: 'John',
          lastName: 'Smith',
          email: 'john.smith@example.com',
          password: '$2b$10$rQZ9QmjytWIHq8fJvXz0/.vQZ9QmjytWIHq8fJvXz0/.vQZ9QmjytW', // Password123
          phone: '+1-555-0101',
          role: 'client',
          isActive: true
        },
        {
          firstName: 'Emily',
          lastName: 'Johnson',
          email: 'emily.johnson@example.com',
          password: '$2b$10$rQZ9QmjytWIHq8fJvXz0/.vQZ9QmjytWIHq8fJvXz0/.vQZ9QmjytW', // Password123
          phone: '+1-555-0102',
          role: 'client',
          isActive: true
        },
        {
          firstName: 'Michael',
          lastName: 'Davis',
          email: 'michael.davis@example.com',
          password: '$2b$10$rQZ9QmjytWIHq8fJvXz0/.vQZ9QmjytWIHq8fJvXz0/.vQZ9QmjytW', // Password123
          phone: '+1-555-0103',
          role: 'client',
          isActive: true
        },
        {
          firstName: 'Sarah',
          lastName: 'Wilson',
          email: 'sarah.wilson@example.com',
          password: '$2b$10$rQZ9QmjytWIHq8fJvXz0/.vQZ9QmjytWIHq8fJvXz0/.vQZ9QmjytW', // Password123
          phone: '+1-555-0104',
          role: 'client',
          isActive: true
        },
        {
          firstName: 'David',
          lastName: 'Brown',
          email: 'david.brown@example.com',
          password: '$2b$10$rQZ9QmjytWIHq8fJvXz0/.vQZ9QmjytWIHq8fJvXz0/.vQZ9QmjytW', // Password123
          phone: '+1-555-0105',
          role: 'client',
          isActive: true
        }
      ];

      await User.insertMany(sampleClients);
      console.log('Created sample client users');
      
      // Refetch users
      const newUsers = await User.find({ role: 'client' }).limit(5);
      users.push(...newUsers);
    }

    // Find an employee user to assign as project manager
    let employeeUser = await User.findOne({ role: 'employee' });
    if (!employeeUser) {
      console.log('No employee user found. Creating sample employee...');
      
      employeeUser = new User({
        firstName: 'Alex',
        lastName: 'Thompson',
        email: 'alex.thompson@houseway.com',
        password: '$2b$10$rQZ9QmjytWIHq8fJvXz0/.vQZ9QmjytWIHq8fJvXz0/.vQZ9QmjytW', // Password123
        phone: '+1-555-0201',
        role: 'employee',
        isActive: true
      });
      
      await employeeUser.save();
      console.log('Created sample employee user');
    }

    // Create projects with assigned clients
    const projectsToCreate = sampleProjects.map((projectData, index) => {
      const clientUser = users[index % users.length]; // Cycle through available clients

      return {
        ...projectData,
        client: clientUser._id,
        assignedEmployees: [employeeUser._id],
        createdBy: employeeUser._id,
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date within last year
        updatedAt: new Date()
      };
    });

    // Insert projects into database
    const createdProjects = await Project.insertMany(projectsToCreate);
    console.log(`Successfully created ${createdProjects.length} sample projects:`);
    
    createdProjects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.title} - Status: ${project.status} - Budget: $${project.budget.estimated.toLocaleString()}`);
    });

    // Create additional random projects for variety
    const additionalProjects = [
      {
        title: "Cozy Cottage Renovation - Vermont",
        description: "Charming 2-bedroom cottage renovation with rustic charm and modern amenities. Features include exposed beams, stone fireplace, and updated kitchen.",
        status: "completed",
        priority: "low",
        projectType: "renovation",
        designStyle: "rustic",
        client: users[0]._id,
        assignedEmployees: [employeeUser._id],
        createdBy: employeeUser._id,
        budget: {
          estimated: 180000,
          actual: 175000,
          currency: "USD"
        },
        timeline: {
          startDate: new Date('2024-01-15'),
          expectedEndDate: new Date('2024-06-30'),
          actualEndDate: new Date('2024-06-25')
        },
        location: {
          address: "123 Mountain View Road",
          city: "Stowe",
          state: "VT",
          zipCode: "05672",
          country: "USA",
          coordinates: {
            latitude: 44.4654,
            longitude: -72.6874
          }
        },
        specifications: {
          area: 1200,
          areaUnit: "sqft",
          floors: 1,
          bedrooms: 2,
          bathrooms: 1,
          parking: 0
        },
        progress: {
          percentage: 100,
          milestones: [
            {
              name: "Design Complete",
              description: "Complete renovation design",
              targetDate: new Date('2024-02-15'),
              completedDate: new Date('2024-02-15'),
              status: "completed"
            },
            {
              name: "Construction Complete",
              description: "All construction work finished",
              targetDate: new Date('2024-06-20'),
              completedDate: new Date('2024-06-20'),
              status: "completed"
            },
            {
              name: "Final Inspection",
              description: "Final inspection and approval",
              targetDate: new Date('2024-06-25'),
              completedDate: new Date('2024-06-25'),
              status: "completed"
            }
          ]
        }
      },
      
      {
        title: "Modern Apartment Complex - Denver",
        description: "50-unit luxury apartment complex with amenities including fitness center, rooftop garden, and underground parking. Sustainable design with LEED certification goals.",
        status: "planning",
        priority: "high",
        projectType: "commercial",
        designStyle: "modern",
        client: users[1]._id,
        assignedEmployees: [employeeUser._id],
        createdBy: employeeUser._id,
        budget: {
          estimated: 15000000,
          actual: 500000,
          currency: "USD"
        },
        timeline: {
          startDate: new Date('2025-01-01'),
          expectedEndDate: new Date('2026-12-31'),
          actualEndDate: null
        },
        location: {
          address: "456 Downtown Boulevard",
          city: "Denver",
          state: "CO",
          zipCode: "80202",
          country: "USA",
          coordinates: {
            latitude: 39.7392,
            longitude: -104.9903
          }
        },
        specifications: {
          area: 75000,
          areaUnit: "sqft",
          floors: 8,
          bedrooms: 50, // Total units
          bathrooms: 75, // Total bathrooms
          parking: 75
        },
        progress: {
          percentage: 5,
          milestones: [
            {
              name: "Site Acquisition",
              description: "Property acquisition complete",
              targetDate: new Date('2024-10-01'),
              completedDate: new Date('2024-10-01'),
              status: "completed"
            },
            {
              name: "Zoning Approval",
              description: "City zoning approval process",
              targetDate: new Date('2024-12-15'),
              status: "pending"
            },
            {
              name: "Design Development",
              description: "Detailed design development phase",
              targetDate: new Date('2025-03-01'),
              status: "pending"
            }
          ]
        }
      },

      {
        title: "Luxury Penthouse - Miami",
        description: "Exclusive penthouse renovation with panoramic bay views. Features include marble finishes, custom millwork, and private elevator access. High-end luxury throughout.",
        status: "in-progress",
        priority: "high",
        projectType: "renovation",
        designStyle: "contemporary",
        client: users[2]._id,
        assignedEmployees: [employeeUser._id],
        createdBy: employeeUser._id,
        budget: {
          estimated: 1800000,
          actual: 900000,
          currency: "USD"
        },
        timeline: {
          startDate: new Date('2024-06-01'),
          expectedEndDate: new Date('2025-02-28'),
          actualEndDate: null
        },
        location: {
          address: "789 Biscayne Boulevard",
          city: "Miami",
          state: "FL",
          zipCode: "33132",
          country: "USA",
          coordinates: {
            latitude: 25.7617,
            longitude: -80.1918
          }
        },
        specifications: {
          area: 4500,
          areaUnit: "sqft",
          floors: 1,
          bedrooms: 3,
          bathrooms: 4,
          parking: 2
        },
        progress: {
          percentage: 60,
          milestones: [
            {
              name: "Demolition Complete",
              description: "Interior demolition completed",
              targetDate: new Date('2024-07-15'),
              completedDate: new Date('2024-07-15'),
              status: "completed"
            },
            {
              name: "Structural Work",
              description: "Structural modifications complete",
              targetDate: new Date('2024-09-30'),
              completedDate: new Date('2024-09-30'),
              status: "completed"
            },
            {
              name: "Systems Installation",
              description: "Electrical and plumbing installation",
              targetDate: new Date('2024-11-15'),
              completedDate: new Date('2024-11-15'),
              status: "completed"
            },
            {
              name: "Millwork Installation",
              description: "Custom millwork and cabinetry",
              targetDate: new Date('2025-01-15'),
              status: "in-progress"
            },
            {
              name: "Final Finishes",
              description: "Final finishes and details",
              targetDate: new Date('2025-02-20'),
              status: "pending"
            }
          ]
        }
      }
    ];

    const moreProjects = await Project.insertMany(additionalProjects);
    console.log(`\nCreated ${moreProjects.length} additional projects:`);
    
    moreProjects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.title} - Status: ${project.status} - Budget: $${project.budget.estimated.toLocaleString()}`);
    });

    console.log(`\n🎉 Successfully populated database with ${createdProjects.length + moreProjects.length} total projects!`);
    console.log('\nProject Status Summary:');
    
    const statusCounts = await Project.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    statusCounts.forEach(status => {
      console.log(`- ${status._id}: ${status.count} projects`);
    });

    const totalBudget = await Project.aggregate([
      { $group: { _id: null, total: { $sum: '$budget.total' } } }
    ]);
    
    console.log(`\nTotal Portfolio Value: $${totalBudget[0].total.toLocaleString()}`);

  } catch (error) {
    console.error('Error populating projects:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

// Run the script
if (require.main === module) {
  populateProjects();
}

module.exports = populateProjects;
