# Milk Pudding Counter

Order counter app for a Thai milk pudding business. Built with React + Vite (frontend) and Express (backend) with file-based JSON storage.

## Prerequisites

- Node.js 18+

## Setup & Running

### 1. Backend

```bash
cd backend
npm install
npm start
```

The API will run at `http://localhost:3000`.

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app will run at `http://localhost:5173`.

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/today` | Today's order count and expected cash |
| `POST` | `/api/orders` | Add a new order (25 ฿ each) |
| `POST` | `/api/today/close` | Close today's orders and create a backup |
| `GET` | `/api/summary` | Last 7 days summary |
| `GET` | `/api/backups` | List all backup files |

## Data Storage

Daily order data is saved as JSON files in `data/YYYY-MM-DD.json`. Backups are created in `backup/` when the day is closed.
