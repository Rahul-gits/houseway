const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User schema (simplified version for this script)
const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: String,
  role: String,
  phone: String,
  employeeDetails: {
    employeeId: String,
    department: String,
    position: String,
    hireDate: Date,
    skills: [String],
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = mongoose.model('User', userSchema);

const createEmployee = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/houseway');
    console.log('✅ Connected to MongoDB');

    // Check if employee already exists
    const existingEmployee = await User.findOne({ email: 'employee@houseway.com' });
    if (existingEmployee) {
      console.log('⚠️  Employee already exists');
      console.log('Email:', existingEmployee.email);
      console.log('Role:', existingEmployee.role);
      console.log('Name:', existingEmployee.firstName, existingEmployee.lastName);
      await mongoose.connection.close();
      return;
    }

    // Create employee user
    const employee = new User({
      firstName: 'Houseway',
      lastName: 'Employee',
      email: 'employee@houseway.com',
      password: 'Password123',
      role: 'employee',
      phone: '+1-555-0101',
      employeeDetails: {
        employeeId: 'EMP-001',
        department: 'Project Management',
        position: 'Project Manager',
        hireDate: new Date('2024-01-01'),
        skills: ['Client Management', 'Project Coordination', 'Design Review', 'Budget Management'],
      },
      isActive: true,
    });

    await employee.save();

    console.log('✅ Employee created successfully!');
    console.log('📧 Email: employee@houseway.com');
    console.log('🔑 Password: Password123');
    console.log('👤 Name: Houseway Employee');
    console.log('🏢 Role: Employee');
    console.log('🆔 Employee ID: EMP-001');

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error creating employee:', error.message);
  }
};

createEmployee();