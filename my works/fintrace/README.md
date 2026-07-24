# 🔍 FinTrace — OSINT & Financial Anti-Money Laundering (AML) Detection Platform

> **Graph-Based Transaction Analysis, Automated AML Detection, and AI-Powered SAR Generation**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg?logo=react)](https://react.dev/)
[![Neo4j](https://img.shields.io/badge/GraphDB-Neo4j-008CC1.svg?logo=neo4j)](https://neo4j.com/)
[![Docker](https://img.shields.io/badge/Deployment-Docker%20Compose-2496ED.svg?logo=docker)](https://www.docker.com/)

---

## 📌 Overview

**FinTrace** is an enterprise-grade OSINT and Financial Intelligence platform engineered for regulatory compliance, anti-money laundering (AML) detection, and fraud investigation. It converts multi-source financial logs, banking CSVs, and transaction histories into graph representations to uncover complex money laundering typologies, shell company networks, and circular transfer rings.

---

## ✨ Key Features

- 🌐 **Graph Topology & Network Visualization**: Interactive 2D/3D transaction graph mapping powered by Neo4j and ReactFlow.
- 🛡️ **Automated AML Typology Engine**: 
  - **Structuring / Smurfing**: Detection of split deposits under regulatory thresholds.
  - **Circular Money Rings**: Deep cycle detection across linked accounts.
  - **Rapid Velocity / Pass-through**: Instant layering identification.
  - **Dormant Account Reactivation**: Unexpected spikes in dormant entities.
  - **Blacklist & Sanctions Matching**: Real-time cross-referencing against watchlists.
- 🤖 **AI-Powered SAR Generator**: Automatic draft creation of official Suspicious Activity Reports (SARs) using local LLM integration (Ollama).
- 📊 **Risk Scoring & Analytics**: Comprehensive entity risk profiling with dynamic risk score weightings.
- 📱 **Multi-Device & WiFi Support**: Cross-device support for mobile, tablet, and desktop on local network environments.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, TailwindCSS v4, Vite, React Router 7, Recharts, ReactFlow (`@xyflow/react`) |
| **Backend** | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 |
| **Databases** | SQLite (development) / PostgreSQL 16 (production), Neo4j 5 Community Graph DB |
| **AI / LLM** | Ollama (Llama 3 / Mistral) for local SAR report generation |
| **DevOps** | Docker, Docker Compose, Vercel, Render |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- Git
- *(Optional)* Docker & Docker Compose

### Option 1: Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Atharvchaudhari1106/fintrace.git
   cd fintrace
   ```

2. **Set up Backend**:
   ```bash
   cd backend
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate

   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```

3. **Set up Frontend**:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

---

### Option 2: Docker Compose (Full Stack)

Run the entire platform including PostgreSQL and Neo4j:

```bash
docker-compose up --build
```

---

## 📑 API Documentation

Once the backend is running, access the interactive Swagger OpenAPI docs at:
- **Swagger UI**: `http://localhost:8000/api/docs`
- **ReDoc**: `http://localhost:8000/api/redoc`

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
