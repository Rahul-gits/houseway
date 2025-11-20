const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // Increased limit to 500 requests per windowMs for development
  message: 'Too many requests from this IP, please try again later.',
  // Skip rate limiting in development mode
  skip: (req, res) => process.env.NODE_ENV === 'development'
});
app.use('/api/', limiter);

// CORS configuration
const allowedOrigins = [
  'http://localhost:19006', // Expo mobile app
  'http://localhost:8081',  // Expo web app (original port)
  'http://localhost:8082',  // Expo web app (port 2)
  'http://localhost:8083',  // Expo web app (current port)
  'http://localhost:3000',  // React development server (if used)
  'exp://localhost:19000',  // Expo development
  'exp://192.168.0.100:19000', // Expo on network
  'exp://192.168.0.100:8082', // Expo on network (port 2)
  'exp://192.168.0.100:8083', // Expo on network (current port)
  'http://192.168.0.100:8081', // Expo on network (original port)
  'http://192.168.1.100:8081', // Expo on network (alternative IP)
  process.env.FRONTEND_URL, // Environment variable URL
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // For development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      console.log('CORS: Allowing all origins in development mode');
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log('CORS: Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 200,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Explicitly handle OPTIONS requests for all routes
app.options('*', (req, res) => {
  console.log('OPTIONS request received for:', req.originalUrl);
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Socket.io real-time setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Make io accessible in routes/controllers
app.set('io', io);

// Core houseway dashboard events
const DASHBOARD_EVENTS = {
  PROJECT_UPDATED: 'projectUpdated',
  MATERIAL_REQUEST: 'materialRequest',
  QUOTATION_UPDATED: 'quotationUpdated',
  PAYMENT_UPLOADED: 'paymentUploaded',
  MESSAGE_THREAD: 'messageThread',
  GENERAL_UPDATE: 'generalUpdate',
};
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

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
      console.log('💡 MongoDB is not available. Starting server without database connection...');
      console.log('💡 Please ensure MongoDB is installed and running locally, or check your MongoDB Atlas connection');
    }
  }
};

connectDB();

// Routes (conditionally load if DB is available)
try {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/projects', require('./routes/projects'));
  app.use('/api/material-requests', require('./routes/materialRequests'));
  app.use('/api/quotations', require('./routes/quotations'));
  app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
  app.use('/api/service-requests', require('./routes/serviceRequests'));
  app.use('/api/files', require('./routes/files'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/work-status', require('./routes/workStatus'));
} catch (routeError) {
  console.error('❌ Error loading routes:', routeError.message);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(error.errors).map(err => err.message),
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
    });
  }
  
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate field value',
    });
  }
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🟢 Socket.io enabled on same port.`);
});
