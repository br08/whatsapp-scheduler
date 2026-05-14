# User Journeys & Edge Cases: WhatsApp Scheduler

## Core Journey: The Happy Path

1. **User** sends a POST request to `/api/schedule` with a valid WhatsApp number, a message body, and a `scheduledTime` (e.g., 10 minutes in the future).
2. **System** saves the message to PostgreSQL with status `PENDING`.
3. **System** enqueues a job in BullMQ to execute at the exact `scheduledTime`.
4. **System** responds with `201 Created` and the `messageId`.
5. _(Time passes)_
6. **Worker** picks up the job, calls the Twilio API, and successfully sends the message.
7. **System** updates the PostgreSQL record status to `SENT`.

## Edge Cases (Must be tested)

1. **Validation Failure:** User sends an invalid phone number format or a `scheduledTime` in the past.
   - _Expected:_ System rejects with `400 Bad Request` and Zod validation errors. DB is not touched.
2. **Twilio API Failure:** Worker attempts to send, but Twilio API is down or returns a 500 error.
   - _Expected:_ Worker catches the error, leaves the DB status as `PENDING`, increments `retryCount`, and relies on BullMQ's exponential backoff to try again.
3. **Max Retries Exceeded:** Worker fails to send after 3 attempts.
   - _Expected:_ Worker marks the PostgreSQL record status as `FAILED`. Job is moved to the BullMQ Dead Letter Queue.
4. **Idempotency Check:** A network blip causes the worker to process the exact same job twice.
   - _Expected:_ Worker checks the DB. If status is already `SENT`, it safely exits without calling Twilio again.
