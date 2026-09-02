<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single product: a **Next.js 16 / React 19 / TypeScript** "Job Application Dashboard" (App Router; API routes under `src/app/api/*`). npm is the package manager. The update script already runs `npm install`, so dependencies are present on startup.

Standard commands live in `package.json` scripts and the README `## Development` section: `npm run dev` (port 3000), `npm run typecheck`, `npm test`, `npm run build`, `npm start`. There is no ESLint config — `npm run typecheck` (`tsc --noEmit`) is the lint/static-quality gate. Tests use Node's built-in runner via `tsx --test` (not Jest/Vitest).

Non-obvious caveats:
- **Demo vs persistent mode:** The app runs fully without any external services. With no Supabase env it starts in `mode: demo` (in-memory sample jobs) — `GET /api/health` reports `mode` and per-service readiness. No login is required in demo mode.
- **Password gate for local testing:** To exercise the `/login` password gate without Supabase, put `DASHBOARD_PASSWORD` and `AUTH_SECRET` in a gitignored `.env.local` (`.env*` is gitignored). Then `/` redirects to `/login`; sign in with that password. The proxy only "fails closed" (503) when Supabase data is configured in `NODE_ENV=production` without dashboard auth.
- **No committed lockfile:** `npm ci` fails (there is no `package-lock.json` in git); always use `npm install`. `npm install` leaves an untracked `package-lock.json` — safe to ignore/leave uncommitted.
- **Next 16 regenerates files on every `next dev`/`next build`:** it re-writes the `<!-- nextjs-agent-rules -->` block in `AGENTS.md`, (re)creates `CLAUDE.md`, and reconfigures `tsconfig.json` + `next-env.d.ts` (e.g. `jsx: react-jsx`, adds `.next/dev/types`). These reappear as uncommitted changes even after `git checkout`; they are framework-managed, not real edits. Committing them (or setting `agentRules: false` in `next.config.ts`) keeps the tree clean.
- **Supabase Edge Functions** (`supabase/functions/*`) are Deno/TypeScript, excluded from the app `tsconfig.json`, and deployed separately via the Supabase CLI — they are not part of the local Next.js dev run.
