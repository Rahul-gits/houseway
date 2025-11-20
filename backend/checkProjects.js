const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import models
const Project = require('./src/models/Project');

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

const checkProjects = async () => {
  try {
    await connectDB();
    
    // Get all projects
    const projects = await Project.find({});
    console.log(`Found ${projects.length} projects in the database:`);
    
    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.title} (ID: ${project._id})`);
      console.log(`   Status: ${project.status}`);
      console.log(`   Client: ${project.client}`);
      console.log('---');
    });
    
    // Get client-specific projects
    console.log('\nChecking for client projects...');
    const clientProjects = await Project.find({}).populate('client', 'firstName lastName email');
    clientProjects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.title}`);
      console.log(`   Client: ${project.client ? project.client.firstName + ' ' + project.client.lastName : 'N/A'}`);
      console.log('---');
    });
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkProjects();