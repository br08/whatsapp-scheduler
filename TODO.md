# Implementation Tracker

**Claude Instructions:** When completing a task, update this file by changing `[ ]` to `[x]` and briefly note any important decisions made.
**CRITICAL TDD RULE:** Do not implement business logic in Phase 6 until all tests in Phase 5 are written and failing. In Phase 6, your goal is strictly to make the tests pass.

## Phase 1: Environment & Schema Bootstrapping

- [x] Initialize `package.json` (`npm init -y`).
- [x] Install dependencies: TypeScript, Prisma, BullMQ, Redis, Twilio, Pino, Zod, Express, plus Vitest and Supertest for testing.
- [x] Install dev dependencies: `@types/node`, `@types/express`, `tsx`, `typescript`.
- [x] Initialize `tsconfig.json` with strict mode enabled.
- [x] Create a `docker-compose.yml` for PostgreSQL and Redis.
- [x] Create a `.env.example` file.

## Phase 2: Database & Schema

- [x] Initialize Prisma (`npx prisma init`).
- [x] Define the `ScheduledMessage` model in `schema.prisma` (id, recipient, body, sendAt, status, retryCount).
- [x] Run `npx prisma generate`.
- [x] Set up the Prisma singleton client in `src/db/client.ts`.

## Phase 3: Core Infrastructure

- [ ] Create the Environment Variable validator using Zod in `src/config/env.ts`.
- [ ] Set up the Pino logger in `src/utils/logger.ts`.
- [ ] Create the Twilio API wrapper in `src/services/twilio.ts`.

## Phase 4: Test Environment Setup

- [ ] Configure Vitest in `vitest.config.ts`.
- [ ] Create a test setup file to wipe the database and flush Redis before each test.
- [ ] Create mock factories for the Twilio API so we don't send real messages during tests.

## Phase 5: Writing the Tests (Failing State)

- [ ] Read `JOURNEY.md`.
- [ ] Write integration tests in `tests/api.test.ts` for the API endpoint (Happy path + Validation edge cases).
- [ ] Write worker logic tests in `tests/worker.test.ts` mocking the queue and Twilio (Happy path + Twilio failure + Max retries + Idempotency).
- [ ] Run `npm run test` and verify that tests fail (since no logic exists yet).

## Phase 6: Implementation (Green State)

- [ ] Create a POST endpoint in `src/api/routes.ts` to accept scheduling requests.
- [ ] Implement Zod validators to validate the incoming payloads (recipient, body, scheduledTime).
- [ ] Setup the BullMQ queue instance in `src/queues/connection.ts`.
- [ ] Implement the BullMQ producer function in `src/queues/producer.ts` to add jobs to the queue.
- [ ] Wire the POST endpoint to the database creation (save as PENDING) and the queue producer.
- [ ] Implement the BullMQ worker and Twilio logic in `src/queues/worker.ts` to process jobs, call Twilio, and update database status to make worker tests pass.
- [ ] Run `npm run test` to ensure full test suite is green.

## Phase 7: Refactoring & Polish

- [ ] Add structured logging (Pino) to the passing worker logic.
- [ ] Add graceful shutdown logic (close DB, close Queue).
- [ ] Ensure graceful shutdown hooks are in place for the Express server and BullMQ connections.
