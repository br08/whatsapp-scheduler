# Claude Code Instructions

# Project Documentation
- Architecture details are in `docs/ARCHITECTURE.md`
- Current tasks are in `docs/TODO.md`
- User journey is in `docs/JOURNEY.md`
- Always check these files before starting new tasks.

## Build & Test Commands

- Start dev server: `npm run dev`
- Run tests: `npm run test`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Generate Prisma: `npx prisma generate`

## Code Style & Rules

- **Strict TypeScript:** Never use `any`. Always define interfaces for payloads.
- **Imports:** Use absolute imports (`@/src/...`).
- **Error Handling:** Never swallow errors. Always use the custom `AppError` class and log via `pino`.
- **Database:** All DB calls must go through the Prisma client singleton in `src/db/client.ts`. Do not instantiate Prisma in individual files.

## Agent Behavior

- After every significant file change, after the end of every Phase and before starting any other, run `npm run test:coverage` and make sure it stays above 95%, then run `npm run test` and make sure all tests pass, then run `npm run typecheck` and make sure any problems are fixed. All this MUST be done before starting any other task or reporting back to the user.
- Do not apologize. Be concise. Show the code.
