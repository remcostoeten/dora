# AI provider setup

Dora's AI assistant works with several providers. You can use a hosted provider
with an API key, or run models locally with [Ollama](#ollama-local) — no key,
and no data leaving your machine.

This guide covers how to get a key for each provider, which models are
recommended, rate-limit and cost notes, and how Dora stores your keys.

## Overview

| Provider  | Needs an API key? | Runs locally? |
| --------- | ----------------- | ------------- |
| Groq      | Yes               | No            |
| OpenAI    | Yes               | No            |
| Anthropic | Yes               | No            |
| Gemini    | Yes               | No            |
| Ollama    | No                | Yes           |
| Mock      | No (web demo)     | n/a           |

**Groq is the default provider** — if no provider is explicitly selected, Dora
uses Groq with the `llama-3.3-70b-versatile` model. The **Mock** provider is used
by the web demo and returns canned responses; it never makes a real API call.

### Where keys are stored

API keys you save in Dora are encrypted at rest with **AES-256-GCM**. The
encryption master key is generated on first run and kept in your operating
system keychain (Keychain on macOS, the Secret Service via gnome-keyring /
libsecret on Linux, Credential Manager on Windows). It is never written to disk
in plaintext. If no OS keychain is available, Dora falls back to a local key
file so the app still works, but the OS keychain is strongly preferred.

You can provide a key in two ways:

1. **In the app** — Sidebar → AI keys → pick a provider → add a key. Saved keys
   are encrypted as described above and can be named and tested.
2. **As an environment variable** — if the matching variable below is set in the
   environment Dora launches from, it is merged in automatically (a saved key
   takes precedence).

| Provider  | Environment variable |
| --------- | -------------------- |
| Groq      | `GROQ_API_KEY`       |
| OpenAI    | `OPENAI_API_KEY`     |
| Anthropic | `ANTHROPIC_API_KEY`  |
| Gemini    | `GEMINI_API_KEY`     |

You can verify a key from **Sidebar → AI keys → Test** before using it.

## Provider setup

### Groq

- **Get a key:** <https://console.groq.com/keys>
- **Set in app or via** `GROQ_API_KEY`
- **Recommended models:**
  - `llama-3.3-70b-versatile` (default) — best quality
  - `llama-3.1-70b-versatile` — balanced
  - `llama-3.1-8b-instant` — fastest, cheapest
  - `mixtral-8x7b-32768` — long context
- **Rate limits & cost:** Groq is very fast and has a generous free tier, which
  is why it is Dora's default. Free-tier accounts are subject to per-minute
  request and token limits; if you hit them, slow down requests or switch to a
  smaller model. See the Groq console for current limits and pricing.

### OpenAI

- **Get a key:** <https://platform.openai.com/api-keys>
- **Set in app or via** `OPENAI_API_KEY`
- **Recommended models:**
  - `gpt-4o` — strong general-purpose, good price/quality
  - `gpt-4o-mini` — fast and inexpensive
  - flagship `gpt-5.5` / `gpt-5.5-pro` when you need maximum capability
- **Rate limits & cost:** Usage is billed per token and there is no free tier.
  Rate limits scale with your usage tier; check the OpenAI dashboard for your
  current limits and spend.

### Anthropic

- **Get a key:** <https://console.anthropic.com/settings/keys>
- **Set in app or via** `ANTHROPIC_API_KEY`
- **Recommended models:**
  - `claude-sonnet-4-6` (default) — balanced quality and speed
  - `claude-haiku-4-5` — fast and inexpensive
  - `claude-opus-4-8` — flagship, highest capability
- **Rate limits & cost:** Usage is billed per token. Rate limits depend on your
  account tier; see the Anthropic console for limits and pricing.

### Gemini

- **Get a key:** <https://aistudio.google.com/app/apikey>
- **Set in app or via** `GEMINI_API_KEY`
- **Recommended models:**
  - `gemini-2.5-flash` (default) — fast, generous free tier
  - `gemini-2.5-pro` — flagship quality
  - `gemini-2.0-flash` — fastest
- **Rate limits & cost:** Google AI Studio offers a free tier suitable for most
  usage, with per-minute and per-day request limits. Paid usage is billed per
  token.
- **Migrating from older Dora versions:** earlier builds stored the Gemini key
  as a plaintext app setting. On upgrade, Dora automatically migrates that
  legacy key into the encrypted key store (it appears as a key named
  "Migrated") and removes the old plaintext setting. No action is needed.

### Ollama (local)

Run models entirely on your own machine — no API key, and no data leaves your
computer.

1. **Install Ollama:** download from <https://ollama.com>. Dora can also detect
   whether Ollama is installed and guide a managed install from
   **Sidebar → AI keys → Ollama** if it is not found.
2. **Start the server** (if you installed Ollama yourself):
   ```bash
   ollama serve
   ```
3. **Pull a model**, for example:
   ```bash
   ollama pull llama3.2
   ```
4. **Select Ollama** as the provider in the assistant. The default model is
   `llama3.2`.

**In-app Ollama manager.** From **Sidebar → AI keys → Ollama**, Dora provides a
built-in manager that:

- checks whether Ollama is installed and whether the server is running;
- can install a managed Ollama for you and pull models, showing live download /
  pull progress;
- lists installed models and lets you pick one, pull new ones, or remove them.

- **Recommended models:**
  - `llama3.2` — good general-purpose default
  - `qwen2.5-coder:7b` — strong SQL/code generation for database work
  - `deepseek-r1:7b` — reasoning-focused for complex query planning
  - or any model you have pulled locally; larger models need more RAM/VRAM.
- **Cost:** free. Everything runs locally, so there is no API key, no per-token
  cost, and no rate limit beyond your own hardware.
- **Notes:** Ollama serves on `http://127.0.0.1:11434` by default. Make sure the
  Ollama app/service is running before selecting it in Dora.

## Troubleshooting

- **Rate limited** — you've exceeded the provider's per-minute or per-day
  request/token quota. Wait and retry, switch to a smaller/faster model, or move
  to a different provider. Local Ollama has no provider rate limit.
- **"Model not found"** — the selected model isn't available on your account, or,
  for Ollama, hasn't been pulled yet. To see what's available, open
  **Sidebar → AI keys**, pick the provider, and use the model picker — Dora
  fetches the live model list from the provider and merges it with its curated
  defaults. For Ollama, run `ollama pull <model>` or pull from the in-app
  manager.
- **Ollama offline** — start the Ollama app/service (`ollama serve`) and confirm
  it responds at `http://127.0.0.1:11434`. The in-app Ollama manager shows
  whether the server is currently running.
- **Invalid key** — on **Test** this means the key was rejected. Re-copy the key
  with no surrounding spaces and confirm it belongs to the selected provider. If
  it still fails, regenerate it at the provider:
  [Groq](https://console.groq.com/keys),
  [OpenAI](https://platform.openai.com/api-keys),
  [Anthropic](https://console.anthropic.com/settings/keys), or
  [Gemini](https://aistudio.google.com/app/apikey).
