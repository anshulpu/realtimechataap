# Realtime Chat App

Realtime chat platform with JWT auth, Socket.IO messaging, and MongoDB persistence. Includes private and room chat, presence, typing indicators, and a contact profile panel.

## Tech Stack

- Node.js, Express, Socket.IO
- MongoDB (Mongoose)
- Redis (optional, for multi-instance scaling)
- Vanilla HTML/CSS/JS frontend

## Project Structure

- `backend/` - API, sockets, auth, models
- `frontend/` - UI assets

## Features

- Register/login with JWT
- Private and room chat
- Online/offline presence
- Typing indicators
- Message delivery/read status
- Profile/contact info panel with block and favorite actions
- Shared media preview grid
- Multi-instance Socket.IO support via Redis adapter

## Requirements

- Node.js 18+
- MongoDB running locally or remotely
- Redis (optional, for multi-instance scaling)

## Quick Start

1. Install dependencies
   - `npm install`
   - `cd backend && npm install`
2. Create environment file
   - Copy `backend/.env.example` to `backend/.env`
   - Update values for MongoDB, JWT, and optional Redis
3. Run backend
   - `cd backend`
   - `npm run dev`
4. Open the UI
   - `http://localhost:4000`

## Environment Variables

Set these in `backend/.env`:

- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `REDIS_URL` - Redis connection string (optional)
- `ALLOW_VERIFIER_USERS` - enable test users when running verification scripts

## Scripts

From `backend/`:

- `npm run dev` - start API and Socket.IO server
- `npm run verify:all` - run multi-instance verification suite
- `npm run cleanup:verifier-users` - remove test users

## Multi-Instance Scaling (Optional)

Set `REDIS_URL` and run multiple backend instances. Socket.IO uses Redis so events and presence sync across nodes.

## License

MIT
