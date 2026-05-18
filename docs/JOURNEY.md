# User Journeys & Edge Cases: WhatsApp Scheduler

## Core Journey: The Happy Path
1. **User** sends a POST request to `/api/schedule` with a valid WhatsApp number, body, and `scheduledTime`.
2. **System** saves the message to PostgreSQL with status `PENDING`.
3. **System** enqueues a job in BullMQ to execute at the exact `scheduledTime`.
4. **System** responds with `201 Created`.
5. *(Time passes)*
6. **Worker** picks up the job and sends an HTTP POST request to the local Evolution API container (`/message/sendText`).
7. **Evolution API** successfully routes the message to WhatsApp.
8. **System** updates the PostgreSQL record status to `SENT`.

## Edge Cases (Must be tested)
1. **Validation Failure:** Invalid phone number format or past date. 
   - *Expected:* Reject with `400 Bad Request`. DB is not touched.
2. **Evolution API Gateway Down:** Worker attempts to send, but the Evolution API Docker container is offline or returns a 500.
   - *Expected:* Worker catches error, DB remains `PENDING`, increments `retryCount`, relies on BullMQ's exponential backoff.
3. **WhatsApp Disconnected:** Evolution API is running, but the user's phone is disconnected from the instance (Returns 401/403).
   - *Expected:* Worker catches the specific authentication error and triggers a critical log.
4. **Max Retries Exceeded:** Worker fails to send after 3 attempts.
   - *Expected:* Mark DB status as `FAILED`. Move job to Dead Letter Queue.
5. **Idempotency Check:** Network blip causes worker to process the exact same job twice.
   - *Expected:* Worker checks DB. If status is already `SENT`, exit safely without calling Evolution API.

## Cleanup Journey

A periodic cleanup job runs on a BullMQ repeatable schedule to prune old terminal-state records from PostgreSQL, keeping the database from growing unbounded.

### Retention Policy (configurable via env vars, with defaults)
- `FAILED_RETENTION_DAYS` (default: **1**) — FAILED messages older than this are deleted.
- `SENT_RETENTION_DAYS` (default: **7**) — SENT messages older than this are deleted.

### Cleanup Flow
1. **Trigger:** BullMQ fires the repeatable cleanup job every hour.
2. **FAILED sweep:** Delete all records with `status = FAILED` and `updatedAt < now - FAILED_RETENTION_DAYS`.
3. **SENT sweep:** Delete all records with `status = SENT` and `updatedAt < now - SENT_RETENTION_DAYS`.
4. **Logging:** Log the count of deleted records for each status at `info` level.
5. **PENDING records are never touched** by the cleanup job regardless of age.

### Cleanup Edge Cases (Must be tested)
1. **SENT past retention:** SENT messages older than `SENT_RETENTION_DAYS` are deleted.
   - *Expected:* Record is removed from the database.
2. **FAILED past retention:** FAILED messages older than `FAILED_RETENTION_DAYS` are deleted.
   - *Expected:* Record is removed from the database.
3. **Within retention window:** SENT or FAILED messages younger than their threshold are untouched.
   - *Expected:* Record remains in the database.
4. **PENDING never deleted:** PENDING messages of any age are never removed.
   - *Expected:* Record remains regardless of how old it is.
5. **Nothing to clean:** Cleanup job runs against an empty or all-PENDING database.
   - *Expected:* Job completes without error; logs zero deletions.