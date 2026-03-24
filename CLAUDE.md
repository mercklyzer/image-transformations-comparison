# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (requires Node.js >=20.9.0)
npm run build    # Build for production
npm start        # Start production server (requires build first)
npm run lint     # Run Biome linter
npm run format   # Auto-format with Biome

node scripts/update-images.js [csv-file]  # Regenerate src/data/images.json from Cloudinary CSV export
```

## Architecture

Next.js 16 app using the **Pages Router** (not App Router). TypeScript with strict mode, Tailwind CSS v4, and Biome for linting/formatting.

- `src/pages/` — routes; `_app.tsx` wraps all pages, `_document.tsx` customizes HTML structure
- `src/pages/api/` — API routes
- `src/styles/globals.css` — global styles with Tailwind import and light/dark CSS variables
- `src/lib/db.ts` — Neon PostgreSQL client; auto-creates/migrates the `reviews` table on first use
- `src/middleware.ts` — validates `auth_token` cookie on all routes except `/login` and `/api/auth/*`
- Path alias `@/*` maps to `src/*`

### Data Flow

**Images** are stored statically in `src/data/images.json` (218 entries) and loaded via `getStaticProps`. Each entry has a `base` filename and Cloudinary URLs for `source`, `photoroom`, and `birefnet-general-lite` transformations.

**Reviews** are stored in Neon PostgreSQL with schema `(filename TEXT, tool TEXT, status TEXT, PRIMARY KEY (filename, tool))`. The API layer converts these to a flat `Record<string, ReviewStatus>` keyed as `{tool}:{base}.png` (e.g. `photoroom:_DSC4035.png`).

### Authentication

Password-based login (`AUTH_PASSWORD` env var) generates an HMAC-SHA256 token stored in an HttpOnly `auth_token` cookie (7-day expiry). The middleware performs a timing-safe comparison on every request.

### Required Environment Variables

```bash
DATABASE_URL=          # Neon PostgreSQL connection string (pooled)
AUTH_PASSWORD=         # Login password
AUTH_SECRET=           # HMAC secret for token generation
```

## Tooling Notes

- **Linter/formatter**: Biome (not ESLint/Prettier). Run `npm run lint` to check, `npm run format` to fix.
- **React Compiler** is enabled via Babel plugin in `next.config.ts`.
- **Tailwind CSS v4** uses `@import "tailwindcss"` syntax (not `@tailwind` directives).