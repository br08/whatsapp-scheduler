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

- Run `npm run typecheck` after every significant file change before reporting back to the user.
- Do not apologize. Be concise. Show the code.
