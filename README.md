# Houseway - House Designing Company Mobile App

A comprehensive MERN stack mobile application for a house designing company with role-based authentication and authorization.

## 🏗️ Architecture

- **Backend**: Node.js + Express + MongoDB
- **Mobile App**: React Native with Expo
- **Authentication**: JWT-based with role-based access control
- **Database**: MongoDB with Mongoose ODM

## 👥 User Roles

- 🧑‍💼 **Owner**: Full access to all features, user management, project oversight
- 👷 **Employee**: Access to assigned projects, material requirements, file uploads
- 🛠️ **Vendor**: View material requirements, upload quotations, download purchase orders
- 👨‍💼 **Client**: View project status, upload documents, track payments
- 👁️ **Guest**: Public access to portfolio and consultation requests

## 📁 Project Structure

```
houseway_project/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── utils/
│   ├── uploads/            # File storage
│   └── package.json
├── mobile-app/             # React Native Expo app
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── navigation/
│   │   ├── context/
│   │   └── utils/
│   └── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Expo CLI
- React Native development environment

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

### Mobile App Setup

```bash
cd mobile-app
npm install
expo start
```

## 🔐 Authentication Flow

1. User logs in with credentials
2. Backend validates and returns JWT token with role information
3. Mobile app stores token in AsyncStorage
4. Navigation guards redirect to role-specific dashboard
5. API requests include JWT token for authorization

## 📱 Features by Role

### Owner Dashboard
- Project management and oversight
- User management (CRUD operations)
- Quotation approval/rejection
- Financial reports and overviews
- Purchase order management

### Employee Dashboard
- View assigned projects
- Post material requirements
- Upload site photos and designs
- Track project progress

### Vendor Dashboard
- View material requirements
- Upload quotations (PDF/Excel)
- Track quotation status
- Download approved purchase orders

### Client Dashboard
- View project status and progress
- Upload documents and approvals
- Track payment history
- Submit feedback and ratings

### Guest View
- Company portfolio
- Consultation request form
- FAQs and blog content

## 🛠️ Development

### Backend API Endpoints

- `POST /api/auth/login` - User authentication
- `POST /api/auth/signup` - User registration
- `GET /api/projects` - Get projects (role-based)
- `POST /api/material-requests` - Create material request
- `POST /api/quotations` - Upload quotation
- `GET /api/quotations` - Get quotations (role-based)

### Mobile App Navigation

- Authentication Stack
- Role-based Dashboard Navigation
- Protected Routes with Guards

## 📄 License

This project is proprietary software for Houseway Company.
