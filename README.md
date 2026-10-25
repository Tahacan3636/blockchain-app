# Blockchain Voting System

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/tests-61%20passing-brightgreen)](#testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A blockchain-based student election system developed as a graduation project. Every vote is stored as a block in a SHA-256 hash chain, so any later change to a vote is detected. Voters authenticate with a one-time voting code, their identity is hidden with HMAC, and every voter can verify that their vote is on the chain with a transaction receipt.

---

## Features

- **Hash-chained ballots**: each vote is a block that stores the hash of the previous block. Changing or deleting any block breaks verification.
- **Tamper detection**: `GET /api/chain/verify` recalculates every hash, checks every link and cross-checks the vote count against the voter registry, so deleting the last block is caught too.
- **One-time voting codes**: the admin imports the voter list from Excel. The system generates a random code for each student, stores only its HMAC hash and returns the codes once as a downloadable Excel file.
- **Voter privacy**: blocks contain `HMAC(secret, studentNumber)`, not the student number. Without the server secret, the hash cannot be brute-forced back to a student number.
- **Double-vote prevention**: enforced inside a database transaction with row locking.
- **Concurrency safety**: chain writes are serialized with a PostgreSQL advisory lock, so 50 simultaneous votes produce 50 valid, consecutive blocks.
- **Verifiable receipt**: voters look up their transaction ID to confirm their vote is on the chain. The receipt does not reveal the chosen candidate.
- **Bilingual interface**: Turkish / English toggle (remembered per browser, or `?lang=en`).
- **Live results and province map**: results are counted directly from the chain and shown on an interactive SVG map of Turkey.
- **Admin panel**: JWT authentication, role-based access, voter import, statistics and election reset.
- **Security hardening**: bcrypt password hashing, rate limiting on voting and login, a centralized error handler that never leaks internal details.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER — Frontend (HTML + Tailwind + JS)    │
│  index.html (vote, results, chain explorer)              │
│  admin.html (admin panel)   js/api.js (single API client)│
└────────────────────────────┬─────────────────────────────┘
                             │  HTTPS + JSON (REST)
┌────────────────────────────▼─────────────────────────────┐
│  APPLICATION LAYER — Backend (Node.js + Express)         │
│                                                          │
│  routes/      HTTP only: read request, call service,     │
│               return JSON                                │
│  middleware/  auth (JWT + role), rate limit, errors      │
│  services/    business logic: vote, chain, voters,       │
│               results                                    │
│  utils/       pure crypto functions (SHA-256, HMAC)      │
└────────────────────────────┬─────────────────────────────┘
                             │  SQL (parameterized)
┌────────────────────────────▼─────────────────────────────┐
│  DATA LAYER — PostgreSQL                                 │
│  blocks · allowed_voters · candidates · users            │
└──────────────────────────────────────────────────────────┘
```

**Request flow for a vote:**
`POST /api/vote` → `voteLimiter` → `routes/public.js` → `voteService.castVote()` → transaction: check voter and code → check `has_voted` → `chainService.appendBlock()` (advisory lock, hash, insert) → mark voter → commit → return `txId`.

---

## How the Blockchain Works

1. A **genesis block** (index 0, `previous_hash = "0"`) starts the chain.
2. Each vote creates a block with data `{ voterHash, candidateId, txId, provinceCode }`.
3. `hash = SHA-256(index | timestamp | canonicalJSON(data) | previous_hash)`.
4. Because the previous hash is part of each block's hash, changing one block invalidates every link after it.
5. Verification recalculates all hashes, checks the links, rejects duplicate voters and compares the vote count with the number of voters marked as having voted.

**Scope note:** the chain is stored in one PostgreSQL database (a *tamper-evident ledger*), not on a distributed peer-to-peer network. It detects modification but cannot prevent an attacker with full database and secret access from rebuilding the chain. Distributing the chain head (anchoring) or multiple nodes are listed as future work.

---

## Getting Started

### Requirements
- Node.js **20+**
- PostgreSQL 14+ (local, Docker or hosted)

### Run locally

```bash
# (optional) PostgreSQL with Docker
docker run -d --name bv-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=blockchain_voting -p 5433:5432 postgres:16

cd Backend
cp .env.example .env      # fill in DB settings and the two secrets
npm install
npm start                 # http://localhost:3000  (serves the frontend too)
```

Admin login: hold the **VOTE** button in the navbar for 3 seconds. Default credentials: `admin` / `ADMIN_PASSWORD` from `.env`.

### Typical demo flow
1. Log in as admin and import `Backend/data/blockchain_veriler.xlsx`. The voting codes are downloaded as Excel.
2. Vote with a student number and its code.
3. Open **CHAIN** to inspect the blocks, verify the chain and look up your TxID receipt.

---

## Testing

```bash
cd Backend
npm test          # 61 tests: unit + integration (uses a separate test database)
npm run test:unit # unit tests only, no database needed
```

| Suite | What it proves |
|-------|----------------|
| `unit/crypto` | SHA-256 test vector, deterministic hashing, HMAC is not brute-forceable SHA-256, voting code format and uniqueness |
| `unit/chain` | Valid chains pass; modified data, recomputed hashes, broken order, forged genesis and duplicate voters are detected |
| `unit/voterList` | Voter list validation and de-duplication |
| `integration/vote` | Full voting flow, wrong or foreign codes, double voting, privacy of the public chain, results, receipts |
| `integration/chain` | Tamper detection on the real database (edit, delete middle, delete last), 50 concurrent votes, 5 concurrent double votes |
| `integration/admin` | Login, bcrypt storage, 401/403 access control, code generation, codes never stored in plain text, reset and clear |

---

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vote` | Cast a vote `{ studentNumber, voterCode, candidateId }` |
| GET | `/api/results` | Results per candidate with percentages and turnout |
| GET | `/api/results/map` | Results per province |
| GET | `/api/chain` | Full blockchain (public audit) |
| GET | `/api/chain/verify` | Verify chain integrity |
| GET | `/api/receipt/:txId` | Check that a vote is on the chain |
| GET | `/api/health` | Server and database status |
| POST | `/api/auth/login` | Admin login, returns JWT |

### Admin (JWT + `admin` role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Election statistics |
| POST | `/api/admin/voters/import` | Import voter list, returns one-time codes (starts a new election) |
| GET | `/api/admin/voters` | Voter list with voted status |
| DELETE | `/api/admin/voters` | Clear voter list and all votes |
| POST | `/api/admin/election/reset` | Delete votes, keep voter list (`{ confirm: true }`) |

---

## Database Schema

| Table | Columns |
|-------|---------|
| `blocks` | block_index, timestamp (TEXT, kept verbatim for hashing), data (JSONB), hash, previous_hash, next_hash |
| `allowed_voters` | student_number, province_code, code_hash (HMAC), has_voted |
| `candidates` | id, name, party, color |
| `users` | username, password_hash (bcrypt), role |

---

## Deployment

### Backend → Render
- **Root Directory:** `Backend` · **Build:** `npm install` · **Start:** `node server.js`
- Environment variables: `DATABASE_URL`, `JWT_SECRET`, `VOTER_HASH_SECRET`, `ADMIN_PASSWORD`, `FRONTEND_URL`

### Frontend → Netlify
- **Publish directory:** `Frontend/public` (no build step)
- The backend URL for production is set in `Frontend/public/js/config.js`.

---

## Project Structure

```
├── Backend/
│   ├── server.js             # Entry point: init DB, start server
│   ├── app.js                # Express app (middleware + routes)
│   ├── config.js             # Environment variables, validated once
│   ├── routes/               # HTTP layer: public.js, auth.js, admin.js
│   ├── services/             # Business logic: vote, chain, voter, result
│   ├── middleware/           # auth (JWT/role), rateLimit, errorHandler
│   ├── utils/                # crypto.js (hash/HMAC), errors.js
│   ├── db/                   # index.js (pool + transactions), init.js (schema)
│   ├── tests/                # unit/ and integration/ tests
│   └── data/                 # sample voter list (Excel)
├── Frontend/public/
│   ├── index.html            # Voting, live results, chain explorer
│   ├── admin.html            # Admin panel
│   ├── css/style.css         # Custom styles
│   ├── js/                   # config, i18n (TR/EN), api (client), app, admin, turkey-map
│   ├── data/tr-cities.json   # Province borders (GeoJSON)
│   └── images/
└── docs/                     # MIMARI.md (architecture & design patterns), DEPLOY-REHBERI.md
```

---

## Developers

- **Muhammed Taha CAN**
- **Furkan YILMAZ**

### Credits

Candidate photos from [Unsplash](https://unsplash.com) (Unsplash License): circuit board by [Tim Käbel](https://unsplash.com/photos/FCrYdP8gohg), old books by [Clem Onojeghuo](https://unsplash.com/photos/0PPKxWtYh0g).

## License

[MIT](LICENSE)
