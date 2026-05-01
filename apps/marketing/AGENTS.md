# Dora marketing agent instructions

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
