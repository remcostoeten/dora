# Dora marketing agent instructions

See root [AGENTS.md](../AGENTS.md) for project-wide conventions.

This app is the public marketing and SEO surface for Dora. Keep identity,
metadata, route policy, and crawl behavior centralized instead of scattering SEO
logic through pages.

## Project rules

- Use Bun for package management and scripts.
- Force Bun for Next.js commands with `bun --bun next ...`.
- Keep `vercel.json` configured with `"bunVersion": "1.x"` for Vercel.
- Use `bunx` instead of `npx` and `bun run` instead of package-manager aliases.
- Keep source files in `src/`.
- Use App Router route groups with parentheses for URL-neutral organization.
- Keep site identity in `src/core/config/site.ts`.
- Keep public route policy in `src/core/config/routes.ts`.
- Generate route metadata through `src/core/config/seo.ts`.
- Add every public page to `routeConfig`; don't hand-edit sitemap entries.
- Keep SEO-critical pages as Server Components unless interactivity is required.

## Docs

- `/docs` is the docs-boilerplate UI ported into `src/modules` (`docs`,
  `navigation`, `search`, `footer`) with its routes in `src/app/(docs)`. It
  renders outside the marketing header and footer.
- Content is the MDX in the repo-root `docs/` folder. A new top-level file or
  folder must also be listed in `source.config.ts` and in a `meta.json`.
- Docs settings (name, logo, footer, edit links) live in
  `src/shared/config/docs-site.ts`. Folder icons in `meta.json` are names from
  `src/shared/icons/icons.tsx`.
- Docs styles are in `src/modules/docs/styles/docs.css` and only apply under
  `.docs-root`. The docs are dark only.
- Every page is also served as Markdown at `<url>.mdx`, and `/llms.txt` lists
  them all.

## SEO rules

- Every indexable route must have a unique title, description, canonical URL,
  sitemap entry, and robots policy.
- `/app` is a mock product surface and must stay `noindex` until it represents
  the real application accurately.
- Don't invent claims about pricing, integrations, telemetry, ratings, users, or
  platform availability.
- Structured data must match visible page content.
- Use stable image dimensions and descriptive alt text for meaningful images.
- Keep primary content available in the initial server-rendered HTML.

## Launch checklist

- Set `NEXT_PUBLIC_SITE_URL` to the production origin.
- Replace placeholder privacy, docs, changelog, and download content before
  indexing them.
- Submit `/sitemap.xml` in Google Search Console after production deployment.
- Run `bun run check` before publishing.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
