# Packaged Linux Monaco rendering regression

Verified on 2026-09-22 with Dora 0.42.0, WebKitGTK 4.1, the installed AUR
binary, and a locally built Tauri debug binary serving `tauri://localhost`.
Native inspection used `tauri-driver` and `WebKitWebDriver` with an isolated
XDG profile and a temporary SQLite connection.

## Cause and fix

Tauri adds a nonce to the inline boot stylesheet in `index.html` and appends
that nonce to the response's `style-src` directive. The resulting policy is:

```text
style-src 'self' 'unsafe-inline' 'nonce-<generated value>'
```

A nonce makes `'unsafe-inline'` ineffective. WebKit blocks Monaco's generated
style attributes and its dynamically created theme stylesheet. Direct CSSOM
property assignments still work, explaining the partially styled editor.
Testing the configured CSP as a meta tag does not reproduce Tauri's nonce
injection.

`app.security.dangerousDisableAssetCspModification: ["style-src"]` preserves
the existing policy's permission for inline styles. Only style-source
modification is disabled; script hashing and the other CSP directives remain
in effect. A native probe confirmed that a new inline script was still blocked
with `script-src-elem`, while a style attribute specifying a 37px height and
123px top was applied.

References: [Tauri CSP](https://tauri.app/security/csp/) and
[configuration](https://v2.tauri.app/reference/config/#securityconfig).

## Native before/after evidence

| Measurement | Original build | Fixed build |
| --- | --- | --- |
| SQL line attributes | `top:10px` / `top:29px`, height 19px | Same |
| SQL computed top | 0px / 0px | 10px / 29px |
| SQL computed height | 0px / 0px | 19px / 19px |
| Comment token | `mtk7`, inherited white | `mtk7`, `rgb(96, 139, 78)` |
| Dynamic theme stylesheet | `style.sheet === null` | Active |
| Font info | Trusted, 14px, line height 19px, character width 8.40234375px | Same |

The computed `.view-lines` font was JetBrains Mono / Fira Code / monospace,
14px with a 19px line height. The actual font measurements were healthy.
The original AUR runtime reported both `style-src-attr` and `style-src-elem`
violations. The debug build reproduced the overlapping text and blocked theme.

The fix leaves the editor host, font loader, and stylesheet order unchanged:
`editor-drizzle` CSS still precedes `index` CSS. It therefore does not depend
on attaching the editor before creation or on a new font measurement workaround.

Drizzle and Prisma were each checked with three lines of TypeScript containing
a comment, a keyword, a numeric literal, and a function call. Both rendered
at tops 10px, 29px, and 48px with 19px heights and distinct token colors.
They reused the same TypeScript editor ID. Returning to SQL reused its original
editor ID and preserved the two default lines and correct rendering. No CSP
violations occurred during these editor checks.

## Recheck

Build from `apps/desktop`:

```sh
bun tauri build --debug --no-bundle
```

When a built DuckDB sidecar already exists, the equivalent frontend/native
verification build can reuse it:

```sh
bun tauri build --debug --no-bundle --config '{"build":{"beforeBuildCommand":"bun run build"}}'
```

Launch `src-tauri/target/debug/dora`, connect a temporary SQLite database, and
open SQL Console. Check default comments, gutter alignment, computed line
positions, and syntax colors. Switch through Drizzle, Prisma, and SQL with
multiline content. Use native devtools or WebKitWebDriver; browser preview and
the web boot smoke do not exercise the packaged response policy.

This verification covers native editor rendering and reuse. It does not claim
Drizzle/Prisma query execution coverage or verification of other operating
systems. No installer package was generated or installed.
