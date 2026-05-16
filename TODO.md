# Implementation Tracker

**Claude Instructions:** When completing a task, update this file by changing `[ ]` to `[x]` and briefly note any important decisions made.
**CRITICAL TDD RULE:** Do not implement business logic in Phase 6 until all tests in Phase 5 are written and failing. In Phase 6, your goal is strictly to make the tests pass.

## Phase 1: Environment & Schema Bootstrapping
- [x] Initialize `package.json` (`npm init -y`).
- [x] Install dependencies: TypeScript, Prisma, BullMQ, Redis, Pino, Zod, Express, `axios` (or `node-fetch`).
- [x] Install dev dependencies: `@types/node`, `@types/express`, `tsx`, `typescript`, Vitest, Supertest.
- [x] Initialize `tsconfig.json` with strict mode enabled.
- [x] Create a `docker-compose.yml` for PostgreSQL, Redis, **AND Evolution API**. Ensure Evolution API exposes port 8080.
- [x] Create a `.env.example` file (Include EVOLUTION_API_URL and EVOLUTION_API_KEY).

## Phase 2: Database & Schema
- [x] Initialize Prisma (`npx prisma init`).
- [x] Define the `ScheduledMessage` model in `schema.prisma` (id, recipient, body, sendAt, status, retryCount).
- [x] Run `npx prisma generate`.
- [x] Set up the Prisma singleton client in `src/db/client.ts`.

## Phase 2.5: Infrastructure Orchestration
- [x] Write a `scripts/init-evolution.ts` script using `axios`.
- [x] Script Logic:
  - Check if Evolution API is reachable at `EVOLUTION_API_URL`.
  - Check if the `scheduler` instance exists.
  - If not, create it.
  - Output the QR code (Base64) to the terminal or save it to a local `qr.png`.
- [x] Add `"infra:up": "docker-compose up -d"` and `"infra:init": "tsx scripts/init-evolution.ts"` to `package.json`.
- [x] Execute `scripts/init-evolution.ts` using tsx so that it generates the Evolution API instance and prints the QR code to the terminal. Note: QR code output depends on outbound WhatsApp WebSocket connectivity; the "scheduler" instance is created and confirmed in the Evolution API DB.

## Phase 3: Core Infrastructure
- [x] Create the Environment Variable validator using Zod in `src/config/env.ts`.
- [x] Set up the Pino logger in `src/utils/logger.ts`.
- [x] Create the WhatsApp REST wrapper in `src/services/whatsapp.ts`. This should use Axios/Fetch to send payloads to the Evolution API container.

## Phase 4: Test Environment Setup
- [x] Configure Vitest in `vitest.config.ts`.
- [x] Create a test setup file to wipe the database and flush Redis before each test.
- [x] Create mock interceptors (using MSW or native Jest/Vitest mocks) for the Evolution API HTTP calls so we don't send real network requests during tests.

## Phase 5: Writing the Tests (Failing State)
- [x] Read `JOURNEY.md`.
- [x] Write API endpoint tests in `tests/api.test.ts` (Happy path + Validation edge cases).
- [x] Write worker tests in `tests/worker.test.ts` (Happy path + Gateway Down + Max retries + Idempotency).
- [x] Run `npm run test` and verify that tests fail. (Failing: missing @/src/api/app and @/src/queues/worker — correct Phase 5 state. Fixed Prisma v7 adapter setup and vitest globals in tsconfig.)

## Phase 6: Implementation (Green State)
- [x] Create a POST endpoint in `src/api/routes.ts` to accept scheduling requests.
- [x] Implement Zod validators to validate the incoming payloads (recipient, body, scheduledTime).
- [x] Setup BullMQ connection in `src/queues/connection.ts` and producer in `src/queues/producer.ts`.
- [x] Wire the POST endpoint to the database creation (save as PENDING) and the queue producer.
- [x] Implement the BullMQ worker logic in `src/queues/worker.ts` to process jobs, call the REST wrapper, and update database status to make worker tests pass.
- [x] Run `npm run test` to ensure full test suite is green. (10/10 passing. Fixed MSW v2 onUnhandledRequest: 'error' blocking passthrough for supertest requests — changed to 'warn'. Used regex-free Zod validation for scheduledTime to avoid Zod v4 API drift.)
- [x] Add test coverage to ensure all code is tested. (Added @vitest/coverage-v8; fileParallelism: false to fix shared-DB race condition under coverage; new tests/whatsapp.test.ts for network-error and malformed-response paths.)
- [x] Ensure coverage is at least 80%. Add more tests if needed. (Branches: 82.6%, Statements: 95.45%, Functions: 88.88%, Lines: 95.45% — all ≥ 80%.)

## Phase 7: Refactoring & Polish
- [x] Add structured logging (Pino) to the worker logic. (Added info logs for job start and success paths in processJob; error path already had logging.)
- [x] Add graceful shutdown logic (close DB, close Queue). (Created src/index.ts with shutdown() that closes HTTP server, worker, queue, Redis, and Prisma in order.)
- [x] Ensure graceful shutdown hooks are in place for the Express server and BullMQ connections. (SIGTERM and SIGINT handlers wired in src/index.ts.)
- [x] Fix any linting errors. (tsc --noEmit clean; 12/12 tests passing.)
- [x] Raise coverage threshold to 95%. (Added tests/infra.test.ts covering env error path, Prisma production guard, and pino-pretty development transport; all four metrics reached 100%. Thresholds updated from 80 → 95 in vitest.config.ts.)
