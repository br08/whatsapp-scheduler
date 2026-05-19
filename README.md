# WhatsApp Scheduler

A reliable service for scheduling future WhatsApp messages. Built on a microservice architecture that separates stateless scheduling logic from the stateful WhatsApp WebSocket connection via the [Evolution API](https://github.com/EvolutionAPI/evolution-api) gateway.

## Tech Stack

- **Runtime:** Node.js v20+ / TypeScript (strict)
- **API:** Express v5
- **Database:** PostgreSQL via Prisma ORM
- **Queue:** Redis + BullMQ (delayed jobs, retries, dead-letter queue)
- **WhatsApp Gateway:** Evolution API (self-hosted via Docker)
- **Validation:** Zod
- **Logging:** Pino
- **Tests:** Vitest + Supertest + MSW

## How It Works

1. Client sends `POST /api/schedule` with a recipient number, message body, and future `scheduledTime`.
2. Message is saved to PostgreSQL as `PENDING` and a BullMQ job is enqueued with the appropriate delay.
3. At the scheduled time, the worker sends an HTTP request to the local Evolution API container.
4. On success the record is updated to `SENT`; on failure BullMQ retries with exponential backoff (max 3 attempts), then marks the record `FAILED`.
5. A repeatable cleanup job prunes old `SENT`/`FAILED` records hourly based on configurable retention windows.

## Prerequisites

- Docker & Docker Compose
- Node.js v20+

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in EVOLUTION_API_URL, EVOLUTION_API_KEY, DATABASE_URL, REDIS_URL
```

### 3. Start infrastructure

```bash
npm run infra:up       # Starts PostgreSQL, Redis, and Evolution API via Docker
npm run infra:init     # Creates the WhatsApp instance and prints the QR code
```

Scan the QR code with WhatsApp to connect the instance.

### 4. Run database migrations

```bash
npm run migrate
```

### 5. Start the dev server

```bash
npm run dev
```

## API

Interactive docs are served at `GET /api-docs` (Swagger UI) when the server is running.

### Schedule a message

```
POST /api/schedule
```

```json
{
  "recipient": "5585981480630",
  "body": "Hello!",
  "scheduledTime": "2026-06-01T10:00:00.000Z"
}
```

**Response `201`**

```json
{ "id": "cmpa2gg140000tmo5tivi24m8" }
```

### List scheduled messages

```
GET /api/schedule
```

### Get a message

```
GET /api/schedule/:id
```

### Cancel a message

```
DELETE /api/schedule/:id
```

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server (infra must be up) |
| `npm run build` | Compile TypeScript for production |
| `npm start` | Run compiled production build |
| `npm test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | TypeScript type-check |
| `npm run infra:up` | Start Docker infrastructure |
| `npm run infra:init` | Initialize Evolution API instance |
| `npm run migrate` | Run Prisma migrations |

## Production Deployment

A `deploy.sh` script and a `whatsapp-scheduler.service` systemd unit file are included for Linux server deployments.

```bash
bash deploy.sh
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | — |
| `EVOLUTION_API_URL` | Evolution API base URL | — |
| `EVOLUTION_API_KEY` | Evolution API global key | — |
| `EVOLUTION_INSTANCE_NAME` | WhatsApp instance name | `scheduler` |
| `PORT` | HTTP server port | `3000` |
| `FAILED_RETENTION_DAYS` | Days to keep FAILED records | `1` |
| `SENT_RETENTION_DAYS` | Days to keep SENT records | `7` |

## License

MIT
