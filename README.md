# Realtime Chat App

A modular realtime chat application built with Node.js, Express, Socket.IO, and MongoDB.

## Structure

- `frontend/` - HTML, CSS, JavaScript UI
- `backend/` - Express API, JWT auth, Socket.IO, MongoDB models

## Features

- JWT authentication (register/login)
- Socket authentication using JWT
- Online/offline presence
- Private 1-to-1 chat
- Group room chat
- Typing indicator
- Message persistence in MongoDB
- Delivery/read status fields
- Responsive modern chat UI with avatars/timestamps
- Notification sound on incoming messages
- WhatsApp-style right-side Contact Info panel for private chats
- Shared media preview grid with image modal/open actions
- Contact actions: block/unblock, favourite/unfavourite, clear chat, delete conversation
- About/status support on user profiles
- Block-aware private typing and messaging enforcement (both directions)
- Multi-instance scaling with Socket.IO Redis adapter
- Cluster-safe online/offline presence

## Contact/Profile Panel

- Open panel: click chat header (avatar/name) while a private chat is selected.
- The panel loads:
   - username, presence, about text
   - shared media and message/media counts
   - relation flags (`blockedByMe`, `blockedMe`, `favourite`)
- Panel actions:
   - `Block/Unblock user`
   - `Add/Remove favourite`
   - `Clear chat` (deletes all messages in that private thread)
   - `Delete conversation` (deletes thread + removes favourite relation)

If either side blocks the other, private messaging/typing is denied and composer is disabled on UI refresh.

## Chat API Additions

These routes are protected (`Authorization`/auth cookie required):

- `GET /api/chat/profile/:userId`
- `GET /api/chat/profile/:userId/media?limit=18`
- `PATCH /api/chat/profile/about`
- `POST /api/chat/users/:userId/block`
- `POST /api/chat/users/:userId/favourite`
- `DELETE /api/chat/conversations/private/:userId/messages`
- `DELETE /api/chat/conversations/private/:userId`
- `DELETE /api/chat/maintenance/verifier-users` (requires `x-maintenance-token` header)

## Maintenance: Remove Verifier/Test Users

If old verifier users (like `sockA_*`, `sockB_*`, `sender_*`, `receiver_*`, `userA_*`, `userB_*`) appear in the list:

1. Set `MAINTENANCE_CLEANUP_TOKEN` in `backend/.env`
2. Restart backend
3. Call:
   - `DELETE /api/chat/maintenance/verifier-users`
   - with header: `x-maintenance-token: <MAINTENANCE_CLEANUP_TOKEN>`

Alternative local cleanup command:
- From `backend/`: `npm run cleanup:verifier-users`

## Preventing Verifier/Test Users in Normal Usage

- `ALLOW_VERIFIER_USERS=false` (default in `.env.example`) blocks registration for known verifier patterns:
   - usernames like `sockA_*`, `sockB_*`, `sender_*`, `receiver_*`, `userA_*`, `userB_*`
   - emails used by verifier scripts (`@test.local`, `a_<id>@mail.com`, `b_<id>@mail.com`, etc.)
- Set `ALLOW_VERIFIER_USERS=true` only when intentionally running verification scripts.

## Run

1. Copy env file:
   - `backend/.env.example` -> `backend/.env`
2. Install backend deps:
   - `cd backend`
   - `npm install`
3. Start backend:
   - `npm run dev`
4. Open:
   - `http://localhost:4000`

## Scaling Across Multiple Server Instances

- Set `REDIS_URL` in `backend/.env` (e.g. `redis://127.0.0.1:6379`)
- Start multiple backend instances (or PM2 cluster)
- Socket.IO uses Redis adapter so events are shared across all instances
- A message sent on one server instance is instantly delivered to clients on other instances

### PM2 Cluster (Optional)

From `backend/`:

- `npm install -g pm2`
- `pm2 start ecosystem.config.cjs`
- `pm2 logs realtime-chat-backend`

### Verify Cross-Instance Delivery (Automated)

1. Ensure Redis is running and `REDIS_URL` is set for each instance.
2. Start two backend instances on different ports (example):
   - Instance A: `PORT=4001 REDIS_URL=redis://127.0.0.1:6379 npm run dev`
   - Instance B: `PORT=4002 REDIS_URL=redis://127.0.0.1:6379 npm run dev`
3. Run verification script from `backend/`:
   - PowerShell: `$env:SERVER_A='http://localhost:4001'; $env:SERVER_B='http://localhost:4002'; npm run verify:multi`

Expected result: `PASS: Message sent on Server A was received on Server B`

### One-Command Full Verification

From `backend/` run:

- `npm run verify:all`

This command will:
- ensure Redis is running,
- start Server A (`4001`) and Server B (`4002`) with the same `REDIS_URL`,
- execute `verify:multi`,
- and clean up test server processes automatically.

## Main Socket Events

- `sendMessage` -> send private or room message
- `receiveMessage` <- realtime incoming message
- `typing` -> typing status
- `userStatus` <- online/offline updates
- `messageStatus` <- delivered/read status updates across instances
