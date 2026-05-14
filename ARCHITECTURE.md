# System Architecture: WhatsApp Scheduler

## 1. System Overview

A reliable scheduling system to send future WhatsApp messages. It must handle server restarts gracefully without dropping messages or sending duplicates.

## 2. Tech Stack

- **Runtime:** Node.js (v20+)
- **Language:** TypeScript (Strict Mode)
- **Database:** PostgreSQL (Relational data)
- **ORM:** Prisma (Type-safe database access)
- **Queue/Cache:** Redis + BullMQ (Task scheduling)
- **External API:** Twilio WhatsApp API
- **Validation:** Zod
- **Logging:** Pino

## 3. Directory Structure

Must follow a modular, domain-driven structure:
├── src/
│ ├── api/ # Express/Fastify routes and controllers
│ ├── config/ # Environment variables (Zod validation)
│ ├── db/ # Prisma singleton client
│ ├── queues/ # BullMQ producers and workers
│ ├── services/ # External API wrappers (TwilioService)
│ ├── types/ # Global TypeScript interfaces
│ └── utils/ # Logger, error handlers
├── docker-compose.yml # Local Postgres and Redis
└── prisma/schema.prisma

## 4. System Data Flow

1. **Intake:** The API receives a request to schedule a message (recipient, body, scheduledTime).
2. **State Creation:** The API saves a `ScheduledMessage` to PostgreSQL with status `PENDING`.
3. **Enqueueing:** The API pushes a job to the BullMQ queue with a `delay` calculated from `scheduledTime`.
4. **Processing:** When the delay expires, the BullMQ worker picks up the job.
5. **Execution:** The worker calls the `TwilioService` to send the WhatsApp message.
6. **State Update:**
   - If successful, update the PostgreSQL record to `SENT`.
   - If failed, update to `FAILED`, log the error, and trigger BullMQ's retry mechanism.

## 5. Constraints & Rules

- **Idempotency:** A message must never be sent twice.
- **Separation of Concerns:** Route handlers must not contain business logic; they should call domain functions.
