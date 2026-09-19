# 🚁 Agri-Drone AI — Production Full-Stack Precision Crop Intelligence SaaS

An AI-powered drone crop field monitoring platform engineered to reconstruct spatial field maps, perform grid tile vegetation stress analysis, isolate high-risk anomaly hotspots, and query local **Ollama (`qwen3-vl:8b`)** for targeted visual disease identification.

---

## 🏗️ Architecture & Pipeline Flow

```text
🚁 DRONE FIELD SCANNING
        ↓
🌦️ WEATHER TELEMETRY INTEGRATION
        ↓
🗺️ FIELD RECONSTRUCTION & GRID TILING (Sharp Engine)
        ↓
🌱 VEGETATION & CANOPY STRESS ANALYSIS
        ↓
📍 HOTSPOT ANOMALY EXTRACTION & CROPPING
        ↓
🤖 TARGETED AI VISION ANALYSIS (Ollama qwen3-vl:8b)
        ↓
📊 COMPOSITE RISK & SEVERITY ASSESSMENT
        ↓
🚨 AUTOMATED ALERT GENERATION
        ↓
🌱 AGRONOMIC MANAGEMENT RECOMMENDATIONS
```

---

## 🛠️ Tech Stack

- **Frontend**: React (JS/JSX), Vite, Tailwind CSS, Leaflet / React Leaflet, Recharts, Lucide Icons, React Router DOM.
- **Backend**: Node.js, Express.js, Multer (File Uploads), Sharp (Tile Grid Processor), Axios, MongoDB / Mongoose (with `mongodb-memory-server` auto-fallback).
- **AI Vision Engine**: Ollama local service (`http://localhost:11434`) model `qwen3-vl:8b`.

---

## ⚡ Quick Start & Running Locally

### 1. Start the Backend Server

```bash
cd backend
npm start
```
*Backend runs on `http://localhost:5000`*.

### 2. Start the Frontend Application

```bash
cd frontend
npm run dev
```
*Frontend runs on `http://localhost:3000`*.

---

## 🤖 Ollama Qwen3-VL Vision AI Configuration

1. Install and start [Ollama](https://ollama.com).
2. Pull the visual model:
   ```bash
   ollama pull qwen3-vl:8b
   ```
3. The platform automatically verifies Ollama health on port `11434`. If Ollama is offline, the backend gracefully falls back to the deterministic agronomic visual analyzer without crashing.

---

## 🌟 Instant Demo Scan Mode

Click **"Launch Demo Scan Mode"** on the Drone Scan page or Dashboard to execute the complete field intelligence pipeline with pre-bundled high-resolution drone orthomosaic imagery out of the box!
