# Literature Monorepo

Multiplayer card game monorepo with:

- `apps/mobile` - React Native Expo app
- `apps/backend` - Node.js + Express + Socket.IO backend
- `packages/shared` - Shared TypeScript types

## Prerequisites

- Node.js 18+
- npm 9+
- Expo CLI (optional global install, or use `npx expo`)
- PostgreSQL (local or hosted)

## Setup

Install dependencies from the monorepo root:

```bash
npm install
```

### Shared package

```bash
npm --workspace packages/shared run build
```

### Backend setup

```bash
cp apps/backend/.env.example apps/backend/.env
npm --workspace apps/backend run dev
```

Generate Prisma client manually if needed:

```bash
npm --workspace apps/backend exec prisma generate
```

### Mobile setup

```bash
npm --workspace apps/mobile run start
```

or directly:

```bash
npx expo start
```

## Environment Variables

Backend (`apps/backend/.env`):

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Access token signing secret
- `JWT_REFRESH_SECRET` - Refresh token signing secret
- `PORT` - Backend HTTP port
- `REDIS_URL` - Redis connection URL
- `GOOGLE_CLIENT_ID` - Google OAuth client ID

Mobile (`apps/mobile` runtime):

- `EXPO_PUBLIC_API_URL` - Base API URL (example: `http://localhost:4000`)
- `EXPO_PUBLIC_SOCKET_URL` - Socket server URL (example: `http://localhost:4000`)

## Run

Backend:

```bash
npm --workspace apps/backend run dev
```

Mobile:

```bash
npm --workspace apps/mobile run start
```

or:

```bash
npx expo start
```
