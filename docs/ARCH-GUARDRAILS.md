# NABD UI Guardrails

- Angular & TypeScript strict settings enabled project-wide.
- No global `CUSTOM_ELEMENTS_SCHEMA`; rely on Angular-native libraries.
- Icons are centralized via `@ng-icons` in `apps/web/src/app/icons.ts`; use `<ng-icon>`.
- Pre-commit hook runs typecheck, lint, and a development build (`pnpm check`).
- Run `pnpm dev:web` and `pnpm dev:api` (or `pnpm dev`) with `NX_DAEMON=false`; API defaults to port 3340.
