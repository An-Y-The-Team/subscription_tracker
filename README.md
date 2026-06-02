# Subscription Tracker

A full-stack web application for tracking subscriptions, managing billing cycles, and generating spending insights.

## Project Structure

This repository is split into two main components:

- **`backend/`**: A FastAPI application providing a robust and lightweight REST API.
- **`frontend/`**: A Next.js application built with TypeScript, Tailwind CSS, and Shadcn UI.

---

## Getting Started

Follow the instructions below to set up and run the backend and frontend services locally.

### Prerequisites

Make sure you have the following installed:

- [Python 3.10+](https://www.python.org/)
- [Bun](https://bun.sh/) (preferred) or [Node.js](https://nodejs.org/) (v18+)

---

### 1. Backend Setup (FastAPI)

1. **Navigate to the backend directory:**

   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   - **macOS/Linux:**

     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

   - **Windows:**

     ```bash
     python -m venv .venv
     .venv\Scripts\activate
     ```

3. **Install the dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Run the development server:**

   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

The backend server will be running at [http://localhost:8000](http://localhost:8000). You can access the interactive Swagger API documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

---

### 2. Frontend Setup (Next.js)

1. **Navigate to the frontend directory:**

   ```bash
   cd frontend
   ```

2. **Install the dependencies:**

   ```bash
   bun install
   # or npm install / pnpm install / yarn install
   ```

3. **Run the development server:**

   ```bash
   bun dev
   # or npm run dev / pnpm dev / yarn dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

---

## API References

- **Health Check**: `GET http://localhost:8000/health`
- **Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Docs**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
