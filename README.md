# Global Shop Manufacturing ERP & AI Platform

An enterprise-grade Manufacturing Execution System (MES) and Enterprise Resource Planning (ERP) platform built with Node.js, Express, PostgreSQL, Prisma ORM, React 19, Vite, and ForgeLogic AI.

## 🚀 Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Run backend & frontend concurrently
npm run dev
```

## 📦 Render Cloud Deployment Setup

### **Service 1: Backend Web Service**
- **Root Directory**: `backend`
- **Environment**: `Node`
- **Node Version**: `20.19.0` (specified in `.nvmrc`)
- **Build Command**: `npm install && npx prisma generate`
- **Start Command**: `node server.js`
- **Environment Variables**:
  - `DATABASE_URL`: `postgresql://...` (Render Postgres URL with SSL enabled)
  - `JWT_SECRET`: `[32+ character random string]`
  - `ERP_ADMIN_PASSWORD`: `[8+ character admin password]`
  - `FRONTEND_ORIGIN`: `https://your-frontend-app.onrender.com`

### **Service 2: Frontend Static Site / Web Service**
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_BASE_URL`: `https://your-backend-service.onrender.com`

## 🛡️ Architecture & Documentation
- OpenAPI / Swagger UI: `http://localhost:4000/api-docs`
- Full System Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
