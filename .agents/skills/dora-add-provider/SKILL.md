---
name: dora-add-provider
description: Adding or changing a hosted-provider account integration — sign in with an account credential, list the user's databases, and build a connection from a picked row without the user pasting a connection string. Use when wiring a Neon/Supabase/Turso/PlanetScale/Vercel/Xata/Cloudflare-style provider module, its Tauri commands, its connect flow and tile, or when changing how a provider token is saved, refreshed, revoked or turned into a credential. Not for a provider whose databases the user reaches by pasting a URL (that is a preset, covered below), not for adding an engine (dora-add-database-driver), and not for how a connection is then opened, stored or torn down (dora-connection-lifecycle).
---

# Add a provider

## Scope

This skill owns the account layer: a provider's API client in Rust, the commands
that expose it, the connect flow that lists resources, and the handoff that turns
a picked row into a `Connection`.

It stops at `onComplete`. Everything after — persisting the connection, stripping
and storing its secret, opening it, health, teardown — is
`dora-connection-lifecycle`'s. If the provider's databases need an engine Dora
cannot speak, that engine is `dora-add-database-driver`'s and lands first.
Command registration and generated bindings are `dora-tauri-boundary`'s. Nothing
here restates any of them.

Eight integrations exist: `supabase`, `turso`, `neon`, `cloudflare`,
`planetscale`, `vercel`, `xata`, `posthog`. Every rule below is derived from
them; `reference.md` has the per-file checklist and the per-provider table.

## Unencodable

- Whether a provider-created connection should carry its origin (provider,
  project, branch ids). `docs/specs/07-serverless-postgres-integrations.md`
  promises it so credentials can be refreshed on rotation; `Connection` in
  `packages/studio/src/features/connections/types.ts` has no such field and
  nothing writes one. Ask before inventing one.
- Which `bindings.ts` copy to update (FINDINGS 4.1) — `dora-tauri-boundary`.

## Workflow

1. Apply the preset test below. If it says preset, stop and do that instead —
   two lines, no module.
2. Confirm the engine exists. Cloudflare D1 and PostHog each needed a new engine
   before their integration could be written.
3. Write `apps/desktop/src-tauri/src/integrations/<name>.rs` first, with its
   decode tests, before any UI. The response shapes are mirrored by hand from
   provider docs and are the part most likely to be wrong.
4. Add commands in `apps/desktop/src-tauri/src/database/commands/integrations.rs`.
5. Add `packages/studio/src/features/integrations/<name>/<name>-api.ts`, then the
   connect flow, then the tile.
6. Finish with the `PROVIDER_PATTERNS` row and the docs rows.

## Invariants

**The test is enumeration, not minting.** An integration is warranted only when
an account-level credential can list the user's databases, so the user picks a
row instead of typing a host. If the provider has no listing API, ship a
**preset** instead: a `DbPreset` member in
`packages/studio/src/features/connections/source-kinds.ts`, a row in
`PROVIDER_PATTERNS`, a `resolvePresetToEngine` case and a
`resolveProviderLabel` case — no Rust module, no commands, no tile. Fly.io,
Railway, Render, Aiven, DigitalOcean, Crunchy Bridge, Timescale, TiDB and
Yugabyte are all presets and none of them has a module. Minting is a bonus, not
the bar: Supabase still asks the user for the project database password and
Vercel still falls back to a pasted `POSTGRES_URL`.

**Preset and integration are additive, not alternatives.** Neon, Supabase and
Vercel are both. The integration is the shortcut; the preset is what recognises
the same database when someone pastes its URL instead. A new integration adds
the preset side too.

**Every provider module exposes the same five things.** `is_connected`,
`disconnect`, `save_token`, `current_account`, and at least one `list_*`. Match
those names — the commands, the `*-api.ts` and the flow are all shaped around
them, and a provider that renames them makes the shared flow shape unreadable.

**`save_token` validates before it stores.** Every module calls a real listing
endpoint with the pasted token and only persists on success, so a bad paste
fails at paste time rather than on first use. Trim the token and reject empty
before spending a request.

**Tokens live in one encrypted setting under `integration.<provider>.<name>`.**
`security::encrypt` on the way in, `storage.set_setting`; `security::decrypt`
and `storage.get_setting` on the way out; `storage.delete_setting` to revoke.
Never put an account token in the keyring, in a connection row, or in a file of
its own.

**`disconnect` deletes every key the provider wrote.** Supabase deletes its
OAuth key, its personal-access-token key, and every remembered project password
via `storage.delete_settings_with_prefix`. A provider that stores more than one
key and clears only one leaves the user signed in after they asked to sign out.

**Short-lived tokens are refreshed in one accessor, not at call sites.** Supabase
stores the whole token set as encrypted JSON, refreshes in
`current_access_token` when expiry is within the skew window, and retries once on
a 401 inside `authed_get`, which every authenticated read goes through. Add a
second refresh path and one of them will rot.

**OAuth needs the hosted proxy; a pasted token does not.** A client secret cannot
ship in the binary, so `oauth_connect` opens the consent page, waits on a
loopback listener, and receives tokens back from the proxy at
`DEFAULT_PROXY_BASE`, overridable with `DORA_OAUTH_PROXY_BASE` for local work.
Supabase is the only provider with one. Without a registered app, offer token
paste — that is what the other seven do.

**Every request goes through `crate::http::client()`.** One shared client, so
one connection pool and the connect and request timeouts in
`apps/desktop/src-tauri/src/http.rs` apply. Never build a `reqwest::Client` in a
provider module.

**Model the levels the API needs to build a URL, flattened to one selectable
row.** `NeonDatabase` carries project id, project name, branch id, database name
and role name together, so the mint step re-discovers nothing. Give a level its
own type and picker only when the user can meaningfully choose inside it — Neon
and PlanetScale surface branches, Xata pins `main`. `current_account` exists to
show which account is connected; it never gates anything.

**The flow picks the engine; the URL has to carry everything else.** The flow
hardcodes `type` — `'postgres'` for Neon, Supabase, Vercel and Xata, `'mysql'`
for PlanetScale, `'libsql'` for Turso, `'d1'` and `'posthog'` for theirs — and it
is never user-selectable. SSL belongs **inside** the URL (`sslmode=require`,
`require_ssl=true`): the `ssl` field on `Connection` is only read by the
field-assembly branch of `frontendToBackendDatabaseInfo` and is ignored whenever
a URL is present. Pooling is the exception that does work as a field —
`poolerMode` rewrites the URL through `setPostgresPoolerMode` — so set the flag
rather than writing `simple_query` yourself.

**The vendor label is recovered from the URL, never set by the flow.**
`inferPresetFromConnection` re-derives the preset by matching the URL against
`PROVIDER_PATTERNS`. A flow that emits a hostname no pattern matches produces a
connection that displays as generic. Xata's `sql.xata.sh` is included; add a
pattern for every other hostname a flow emits.

**Where the credential lives follows from whether the engine has a slot for
it.** Postgres, MySQL and libSQL take a URL, so mint the secret into the URL,
hand it to `onComplete`, and let the normal save path strip and store it —
`extract_sensitive_data` pulls the password out of the connection string.
Engines with no URL credential slot keep nothing on the connection: D1 stores
only `d1://{account}/{database}` and PostHog only `posthog://{region}/{project}`,
and the backend re-reads the token from the integration setting at connect time.
The consequence is a real behaviour split — after `disconnect`, a Neon or
PlanetScale connection keeps working and a D1 or PostHog connection stops. Say
which one you are building.

**Provider API failures are inline and actionable; database failures are not the
flow's problem.** Every module maps a 401 to a specific sentence naming the fix
("reconnect your account", "generate a new key"), and PlanetScale maps 403 to the
missing token scope by name. Failures reach the user through
`setAuthError(formatBackendError(error))` inside the flow, not a toast — toasts
are for side errands like opening a browser or copying a URL. No flow tests the
database connection, and none should: `onComplete` hands over a connection and
the ordinary connect path reports whether it opens.

**Non-success responses keep their body.** Read the body with the module's
`read_body` before deciding, so a failure surfaces as
`HTTP {status}: {body}` rather than a bare status, and decode errors say which
response failed to decode.

**Every `*-api.ts` is a thin wrapper and nothing else.** `assertTauriRuntime()`
first, then the generated `commands.*` call, then unwrap by throwing
`result.error` when `result.status === 'error'`. Pure URL builders may live
there; state, retries and React may not.

**A flow renders the shared mock outside Tauri.** The exported component checks
`useIsTauri()` and returns `MockProviderConnectFlow` with a config from
`packages/studio/src/features/integrations/_shared/mock-provider-data.ts`,
delegating to an inner component for the real path. Without it, the marketing
build and the browser preview hit `assertTauriRuntime` and throw.

**Decode tests are the deliverable, and they run offline.** Every module has a
`#[cfg(test)]` block that decodes recorded JSON, including the payloads the
provider got wrong: Neon's branch marked `default`, `primary`, or both; Vercel's
null pagination cursor and its preference for the pooled URL over
`DATABASE_URL`. Live checks belong in `tools/scripts/verify-providers.ts`, never
in CI.

## Common mistakes

- Writing a module for a provider that has no listing API, when two preset lines
  would have done it.
- Adding the integration and skipping the `PROVIDER_PATTERNS` row, so a pasted
  URL for the same database is unrecognised and the connection reads as generic.
- Storing the token before validating it, so a typo surfaces later as a
  mysterious empty list.
- Deleting one setting key in `disconnect` when the provider wrote several.
- Refreshing an expired token at a call site instead of in the shared accessor.
- Setting `ssl: true` on the connection and expecting TLS, when the URL is what
  is read.
- Writing `simple_query` into the URL by hand instead of setting `poolerMode`.
- Building a `reqwest::Client` in the module, losing the shared pool and the
  timeouts.
- Collapsing a 401 into a generic failure instead of naming the fix.
- Testing the database connection inside the flow, duplicating what the connect
  path already reports.
- Omitting the `useIsTauri()` mock branch, which breaks the marketing build.
- Re-fetching ids at mint time that the selectable row could have carried.

## Verification

From `apps/desktop/src-tauri`:

```bash
cargo test
```

From the repository root:

```bash
bun run --cwd packages/studio typecheck
bun run --cwd apps/desktop typecheck
bun run lint
```

Against the live APIs, with a token in the environment and never in CI:

```bash
bun run verify:providers
```

That harness replicates what the Rust module does and reports shape mismatches
before release. Extend it for the new provider; it covers only some of the eight
today.

## Definition of done

- The preset test was applied and the answer was "integration", or a preset
  shipped instead.
- The module exposes `is_connected`, `disconnect`, `save_token`,
  `current_account` and at least one `list_*`, all through
  `crate::http::client()`.
- `save_token` validates against a real endpoint before persisting; the token is
  encrypted under `integration.<provider>.<name>`; `disconnect` removes every key
  the provider wrote.
- A 401 and any provider-specific permission failure each produce a sentence
  naming the fix.
- The flow emits a `Connection` with the right engine, SSL expressed in the URL,
  and a hostname that `PROVIDER_PATTERNS` matches.
- The flow renders the shared mock outside Tauri and reports errors with
  `setAuthError(formatBackendError(error))`.
- Decode tests cover the awkward payloads and pass offline.
- `cargo test` and both typechecks pass.

See `reference.md` for the file-by-file checklist, the per-provider auth and
credential table, and what each existing integration models.
