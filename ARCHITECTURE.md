# System Architecture: WhatsApp Scheduler

## 1. System Overview

A reliable scheduling system to send future WhatsApp messages. It utilizes a microservice architecture to separate the stateless scheduling logic from the stateful WhatsApp WebSocket connection.

## 2. Tech Stack

- **Runtime:** Node.js (v20+)
- **Language:** TypeScript (Strict Mode)
- **Database:** PostgreSQL (Relational data)
- **ORM:** Prisma (Type-safe database access)
- **Queue/Cache:** Redis + BullMQ (Task scheduling)
- **WhatsApp Gateway:** Evolution API (Self-hosted via Docker)
- **Validation:** Zod
- **Logging:** Pino

## 3. Directory Structure

Must follow a modular, domain-driven structure:
├── src/
│ ├── api/ # Express routes and Zod controllers
│ ├── config/ # Environment variables (Zod validation)
│ ├── db/ # Prisma singleton client
│ ├── queues/ # BullMQ producers and workers
│ ├── services/ # Evolution API REST client wrapper (whatsapp.ts)
│ ├── types/ # Global TypeScript interfaces
│ └── utils/ # Logger, error handlers
├── docker-compose.yml # Postgres, Redis, AND Evolution API
└── prisma/schema.prisma

## 4. System Data Flow

1. **Intake:** The API receives a request to schedule a message.
2. **State Creation:** Saves `ScheduledMessage` to PostgreSQL as `PENDING`.
3. **Enqueueing:** Pushes a job to BullMQ with a calculated delay.
4. **Processing:** BullMQ worker picks up the job.
5. **Execution:** Worker sends an HTTP POST request to the local Evolution API container. Evolution API handles the actual WhatsApp delivery.
6. **State Update:**
   - If successful, update the PostgreSQL record to `SENT`.
   - If failed, update to `FAILED`, log the error, and trigger BullMQ's retry mechanism.

## 5. Constraints & Rules

- **Idempotency:** A message must never be sent twice.
- **Separation of Concerns:** Route handlers must not contain business logic; they should call domain functions.
- **Microservice Boundary:** The Node.js application must NEVER attempt to manage WhatsApp WebSockets directly. All communication must happen via REST to the Evolution API.
