# Enterprise Asset Management (EAM) System

A full-stack Enterprise Asset Management (EAM) application developed during the BHEL internship project to streamline asset tracking, allocation, monitoring, and management within an organization.

🌐 **Live Application:**  
https://bhel-internship-project-eam.vercel.app/

## Overview

The Enterprise Asset Management System provides a centralized platform for managing organizational assets throughout their lifecycle. The application enables administrators and employees to efficiently track, allocate, monitor, and maintain assets while ensuring secure access through authentication and role-based management.

The project was developed using a modern full-stack architecture with React, Node.js, Express, PostgreSQL, and cloud deployment services.

## Features

### Authentication & Security
- Secure user authentication
- JWT-based authorization
- Password encryption using bcrypt
- Protected routes and APIs
- Session management

### Asset Management
- Create new assets
- Update asset details
- Delete assets
- View asset inventory
- Asset categorization
- Asset status tracking

### Asset Allocation
- Assign assets to employees
- Track allocated assets
- Asset return management
- Allocation history

### Dashboard
- Asset overview
- Status summaries
- Inventory monitoring
- Management insights

### File Upload Support
- Asset image uploads
- Document attachments
- Secure file handling using Multer

## Tech Stack

### Frontend
- React.js
- Vite
- React Router
- Axios
- CSS

### Backend
- Node.js
- Express.js
- JWT Authentication
- Multer
- bcryptjs

### Database
- PostgreSQL
- Neon Cloud Database

### Deployment
- Frontend: Vercel
- Backend: Render
- Database: Neon PostgreSQL

## Architecture

```text
Frontend (React + Vite)
        │
        ▼
Backend (Node.js + Express)
        │
        ▼
PostgreSQL Database (Neon Cloud)
```

## Project Structure

```text
BHEL_INTERNSHIP_PROJECT_EAM
│
├── FRONTEND
│   ├── src
│   ├── public
│   ├── package.json
│   └── vite.config.js
│
├── BACKEND
│   ├── src
│   ├── uploads
│   ├── package.json
│   └── server.js
│
└── README.md
```

## Installation

### Clone Repository

```bash
git clone https://github.com/Suhas-git-25/BHEL_INTERNSHIP_PROJECT_EAM.git
cd BHEL_INTERNSHIP_PROJECT_EAM
```

### Backend Setup

```bash
cd BACKEND
npm install
```

Create a `.env` file:

```env
DB_CONNECT_STRING=your_postgresql_connection_string
JWT_SECRET=your_secret_key
PORT=5000
```

Run backend:

```bash
npm start
```

### Frontend Setup

```bash
cd FRONTEND
npm install
```

Create a `.env` file:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Run frontend:

```bash
npm run dev
```

## Deployment Links

### Frontend

https://bhel-internship-project-eam.vercel.app/

### Backend

https://bhel-internship-project-eam.onrender.com/

## Database

Hosted on Neon PostgreSQL Cloud.

## Security

- JWT Authentication
- Password Hashing (bcrypt)
- Environment Variable Protection
- Secure API Access
- Cloud Database Connectivity

## Learning Outcomes

This project demonstrates:

- Full Stack Web Development
- REST API Development
- Authentication & Authorization
- PostgreSQL Database Integration
- Cloud Deployment
- Version Control using Git & GitHub
- Enterprise Asset Management Concepts

## Future Enhancements

- QR Code Asset Tracking
- Email Notifications
- Asset Maintenance Scheduling
- Audit Logs
- Advanced Analytics Dashboard
- Report Generation (PDF/Excel)
- Role-Based Permission System
- Asset Depreciation Tracking


## Organization

Developed as part of the internship project associated with Bharat Heavy Electricals Limited (BHEL), one of India's leading engineering and manufacturing enterprises. :contentReference[oaicite:0]{index=0}
