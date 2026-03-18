# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server (requires build first)
npm run lint     # Run Biome linter
npm run format   # Auto-format with Biome
```

## Architecture

Next.js 16 app using the **Pages Router** (not App Router). TypeScript with strict mode, Tailwind CSS v4, and Biome for linting/formatting.

- `src/pages/` — routes; `_app.tsx` wraps all pages, `_document.tsx` customizes HTML structure
- `src/pages/api/` — API routes
- `src/styles/globals.css` — global styles with Tailwind import and light/dark CSS variables
- Path alias `@/*` maps to `src/*`

## Tooling Notes

- **Linter/formatter**: Biome (not ESLint/Prettier). Run `npm run lint` to check, `npm run format` to fix.
- **React Compiler** is enabled via Babel plugin in `next.config.ts`.
- **Tailwind CSS v4** uses `@import "tailwindcss"` syntax (not `@tailwind` directives).
