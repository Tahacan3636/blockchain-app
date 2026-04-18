# Blockchain Voting System

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A blockchain-based voting/election system built as a Software Engineering course project. Votes are recorded as blocks in a SHA-256 hash chain, ensuring immutability and tamper detection. Features a real-time results dashboard, interactive Turkey election map, admin panel with voter management, and full blockchain verification.

---

## Features

- **Blockchain-Backed Voting** — Each vote creates a new block linked to the previous one via SHA-256 hashes. Tampering with any block invalidates the entire chain.
- **Voter Privacy** — Voter IDs are hashed before storage. The system prevents double voting without revealing identities.
- **Real-Time Results** — Live vote counts and percentage bars update as votes come in.
- **Interactive Election Map** — Province-level results displayed on an SVG map of Turkey using React Simple Maps.
- **Admin Dashboard** — Manage users, import voter lists from Excel, view statistics, reset elections.
- **JWT Authentication** — Role-based access control (voter/admin) with bcrypt password hashing.
- **Chain Verification** — API endpoint to verify the entire blockchain integrity block by block.
- **Allowed Voter Lists** — Admin can import an Excel file of authorized student IDs and province codes.

---

## Tech Stack

| Backend | Frontend |
|---------|----------|
| Node.js + Express.js 4 | HTML5 / CSS3 / Tailwind CSS |
| PostgreSQL | Next.js 14 + React 18 |
| JWT + bcrypt | React Simple Maps (Turkey SVG) |
| SHA-256 blockchain (crypto) | Vanilla JS + Fetch API |
| xlsx (Excel parsing) | TypeScript |

---

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│    Frontend      │  HTTP   │    Backend       │
│  (Netlify)       │◄───────►│  (Render)        │
│                  │         │                  │
│  Static HTML/JS  │         │  Express.js API  │
│  Next.js (map)   │         │  PostgreSQL DB   │
│  Tailwind CSS    │         │  Blockchain      │
└─────────────────┘         └─────────────────┘
```

The frontend is a static site deployed on **Netlify**. The backend is a REST API deployed on **Render** with a managed PostgreSQL database. Communication happens via JSON over HTTPS with CORS configured.

---

## Getting Started

### Requirements
- Node.js **v18+**
- PostgreSQL (local or hosted)
- npm

### 1. Backend Setup

```bash
cd Backend
cp .env.example .env    # Edit .env with your database credentials
npm install
npm run db:init         # Create tables + seed data
npm start               # http://localhost:3000
```

### 2. Frontend Setup

```bash
cd Frontend
npm install
npm run dev             # http://localhost:3001
```

Update `Frontend/public/js/config.js` to point to your backend URL:

```javascript
const API_BASE = 'http://localhost:3000';  // Change for production
```

### Default Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |

---

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT token |
| POST | `/api/vote` | Cast a vote (voter ID required) |
| GET | `/api/results` | Get election results with percentages |
| GET | `/api/results/map` | Get province-level results for the map |
| GET | `/api/chain` | Get the full blockchain |
| GET | `/api/chain/verify` | Verify blockchain integrity |
| GET | `/api/health` | Health check (server + database status) |

### Admin (requires JWT + admin role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Election statistics dashboard |
| GET | `/api/admin/users` | List all users |
| PATCH | `/api/admin/users/:id/role` | Change a user's role |
| DELETE | `/api/admin/users/:id` | Delete a user |
| POST | `/api/admin/voters/import` | Import voter list from Excel data |
| GET | `/api/admin/voters` | Get the allowed voter list |
| DELETE | `/api/admin/voters` | Clear voter list and reset votes |
| POST | `/api/admin/election/reset` | Reset the entire election (requires `{ confirm: true }`) |

---

## Database Schema

| Table | Description |
|-------|-------------|
| `candidates` | Election candidates (id, name, party, color) |
| `voters` | Hashed voter records for double-vote prevention |
| `blocks` | Blockchain blocks (index, timestamp, data as JSONB, hash, previous_hash, next_hash) |
| `users` | Registered users with bcrypt password hashes and roles |
| `allowed_voters` | Admin-imported list of authorized voter IDs and province codes |

---

## How the Blockchain Works

1. A **genesis block** is created during database initialization (index 0, previous_hash = "0").
2. When a voter casts a vote, a new block is created containing:
   - Hashed voter ID (SHA-256)
   - Candidate ID
   - Transaction ID (unique hash)
   - Province code
3. The block's hash is calculated from: `index | timestamp | data | previous_hash`
4. Each block references the previous block's hash, forming an immutable chain.
5. The `/api/chain/verify` endpoint recalculates every hash and checks all links.

---

## Deployment

### Backend → Render

1. Create a **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repository
3. Settings:
   - **Root Directory:** `Backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Add environment variables:
   - `DATABASE_URL` — Render PostgreSQL connection string
   - `JWT_SECRET` — Strong random secret (min 32 chars)
   - `FRONTEND_URL` — Your Netlify URL
   - `ADMIN_PASSWORD` — Admin account password

### Frontend → Netlify

1. Create a new site on [netlify.com](https://netlify.com)
2. Connect your GitHub repository
3. Settings:
   - **Base directory:** `Frontend`
   - **Build command:** *(leave empty)*
   - **Publish directory:** `Frontend/public`
4. Update `Frontend/public/js/config.js` with your Render backend URL

### PostgreSQL Database

Create a free PostgreSQL instance on Render:
1. Render Dashboard → New → PostgreSQL
2. Copy the **Internal Database URL**
3. Add it as `DATABASE_URL` in your backend environment variables

---

## Project Structure

```
blockchain-voting-system/
├── Backend/
│   ├── server.js              # Entry point
│   ├── package.json
│   ├── .env.example           # Environment variables template
│   ├── db/
│   │   ├── index.js           # PostgreSQL connection pool
│   │   └── init.js            # Table creation & seed data
│   ├── routes/
│   │   ├── api.js             # Voting, results, blockchain endpoints
│   │   ├── auth.js            # Register & login (JWT)
│   │   └── admin.js           # Admin panel endpoints
│   ├── middleware/
│   │   └── auth.js            # JWT authentication & role checks
│   ├── utils/
│   │   └── blockchain.js      # SHA-256 hashing & block utilities
│   └── data/
│       └── blockchain_veriler.xlsx
├── Frontend/
│   ├── public/                # Static files (HTML, JS, CSS)
│   │   ├── index.html         # Main voting page
│   │   ├── admin.html         # Admin dashboard
│   │   ├── js/
│   │   │   ├── config.js      # API base URL configuration
│   │   │   ├── api.js         # API client
│   │   │   ├── blockchain.js  # Client-side blockchain utilities
│   │   │   └── turkey-map.js  # Map interaction logic
│   │   └── images/
│   ├── app/                   # Next.js pages (election map)
│   ├── components/            # React components
│   ├── lib/                   # TypeScript helpers
│   └── package.json
├── docs/                      # Project documentation
├── .gitignore
└── README.md
```

---

## Scripts

### Backend

| Command | Description |
|---------|-------------|
| `npm start` | Start the production server |
| `npm run dev` | Start with auto-reload (nodemon) |
| `npm run db:init` | Create tables and seed initial data |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server on port 3001 |
| `npm run build` | Build for production |

---

## Developers

- **Muhammed Taha CAN**
- **Ilhan Sidal KARADENIZ**
- **Furkan YILMAZ**

## License

[MIT](LICENSE)
