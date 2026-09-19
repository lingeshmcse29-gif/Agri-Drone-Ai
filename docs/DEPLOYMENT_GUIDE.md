# 🚀 AgriDrone AI — Complete Cloud & Backend Hosting Guide

This guide details how to deploy the entire **AgriDrone AI** platform (React Frontend + Express Backend + MongoDB) to cloud hosting for free.

---

## 📋 Table of Contents
1. [Architecture & Hosting Options](#1-architecture--hosting-options)
2. [Step 1: Free Cloud Database (MongoDB Atlas)](#step-1-free-cloud-database-mongodb-atlas)
3. [Step 2: Deploy to Render.com (Recommended — Full-Stack Single URL)](#step-2-deploy-to-rendercom-recommended--full-stack-single-url)
4. [Step 3: Alternative — Split Deploy (Vercel Frontend + Render Backend)](#step-3-alternative--split-deploy-vercel-frontend--render-backend)
5. [Step 4: Alternative — Docker / VPS Hosting](#step-4-alternative--docker--vps-hosting)
6. [Environment Variables Reference](#environment-variables-reference)

---

## 1. Architecture & Hosting Options

| Platform | Frontend | Backend | Database | Cost | Complexity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Render.com (Unified)** *(Recommended)* | Bundled SPA | Node.js / Express | MongoDB Atlas | **Free** | ⭐ Easy (1 Service) |
| **Vercel + Render** | Vercel Edge | Render Web Service | MongoDB Atlas | **Free** | ⭐⭐ Moderate (2 Services) |
| **Railway.app** | Bundled SPA | Railway Service | Railway MongoDB Plugin | Free trial / $5 | ⭐ Easy |
| **Docker / VPS** | Containerized | Containerized | Local / Container | VPS Cost (~$5/mo) | ⭐⭐⭐ Advanced |

---

## Step 1: Free Cloud Database (MongoDB Atlas)

Both Render and Vercel need a cloud MongoDB database so data persists across deployments:

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up for a free account.
2. Click **Build a Database** and select the **M0 Free** shared cluster.
3. Choose any provider/region (e.g., AWS / `us-east-1` or `ap-south-1`).
4. **Create Database Credentials**:
   - Username: `agridrone_admin`
   - Password: *(generate a secure password and save it)*
5. **Network Access**:
   - Under **Network Access**, add IP Address: `0.0.0.0/0` (Allow Access from Anywhere so cloud servers can connect).
6. **Copy Connection String**:
   - Click **Connect** &rarr; **Drivers (Node.js)**.
   - Copy your URI:
     ```text
     mongodb+srv://agridrone_admin:<password>@cluster0.xxxx.mongodb.net/agri_drone_ai?retryWrites=true&w=majority
     ```

---

## Step 2: Deploy to Render.com (Recommended — Full-Stack Single URL)

Render provides free hosting for Node.js web services with automatic HTTPS and native support for C++ image libraries (Sharp).

The project is already pre-configured so that **one single Render service** builds the React frontend, hosts the Express backend API, and serves the static frontend assets.

### Method A: 1-Click Blueprint Deploy (Fastest)

1. Log into [Render.com](https://dashboard.render.com).
2. Click **New +** &rarr; **Blueprint**.
3. Connect your repository: **`lingeshmcse29-gif/Agri-Drone-Ai`**.
4. Render will automatically detect [`render.yaml`](file:///c:/Users/LEO/Downloads/Agri/render.yaml).
5. When prompted, paste your `MONGO_URI` from Step 1.
6. Click **Apply**. Render will automatically:
   - Install dependencies for both frontend and backend
   - Build the React SPA
   - Launch the production server at `https://<your-service-name>.onrender.com`

---

### Method B: Manual Web Service Setup on Render

1. On [Render Dashboard](https://dashboard.render.com), click **New +** &rarr; **Web Service**.
2. Connect **`https://github.com/lingeshmcse29-gif/Agri-Drone-Ai`**.
3. Configure the following fields:
   - **Name**: `agridrone-ai` (or your choice)
   - **Region**: Oregon or Singapore (closest to you)
   - **Branch**: `main`
   - **Root Directory**: *(leave blank)*
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm run install:all && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
   - **Instance Type**: `Free`

4. Click **Advanced** &rarr; **Add Environment Variables**:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations |
| `APP_MODE` | `DEMO` | Enables full drone scan pipelines with fallback |
| `MONGO_URI` | `mongodb+srv://...` | Your MongoDB Atlas connection URI |
| `JWT_SECRET` | `your_long_random_secret_32_characters_here` | Session and JWT auth secret |
| `PORT` | `10000` | Render default port (injected automatically) |
| `UPLOAD_DIR` | `./uploads` | Temporary upload storage |

5. Click **Create Web Service**.  
   *Your live application will be available at: `https://<your-service-name>.onrender.com` in ~3–5 minutes.*

---

## Step 3: Alternative — Split Deploy (Vercel Frontend + Render Backend)

If you prefer hosting the React frontend on **Vercel** and backend on **Render**:

### 1. Deploy Backend to Render:
- Follow Step 2 (Method B), with:
  - **Root Directory**: `backend`
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`
- Note your backend URL (e.g., `https://agridrone-backend.onrender.com`).

### 2. Deploy Frontend to Vercel:
1. Log into [Vercel](https://vercel.com) and click **Add New...** &rarr; **Project**.
2. Import **`lingeshmcse29-gif/Agri-Drone-Ai`**.
3. Configure settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
4. Add Environment Variable:
   - `VITE_API_URL` = `https://agridrone-backend.onrender.com/api`
5. Click **Deploy**.
6. In Render backend environment variables, update `CORS_ORIGINS` to include your Vercel URL (e.g. `https://agridrone-frontend.vercel.app`).

---

## Step 4: Alternative — Docker / VPS Hosting

To run on any Linux VPS (Ubuntu/Debian, DigitalOcean, AWS EC2, Hetzner):

```bash
# 1. Clone repository
git clone https://github.com/lingeshmcse29-gif/Agri-Drone-Ai.git
cd Agri-Drone-Ai

# 2. Build and start containers
docker compose up -d --build

# 3. View status and logs
docker compose ps
docker compose logs -f app
```
The stack will be live at `http://<your-server-ip>:5001`.

---

## 🛠️ Post-Deployment Verification Checklist

Once deployed, verify your deployment:

1. **Health Check**: Visit `https://your-service.onrender.com/api/health`  
   *Expected Response:* `{"success":true,"data":{"status":"healthy","database":"connected"}}`
2. **Seed Demo Data (Optional)**: If you want pre-populated fields and scans on your cloud MongoDB, run the seeder locally with your cloud `MONGO_URI`:
   ```powershell
   $env:MONGO_URI="mongodb+srv://..."; npm run seed:demo
   ```
3. **Interactive Drone Scan**: Open `https://your-service.onrender.com`, click **Drone Scan**, and launch the pipeline using the demo orthomosaic.
