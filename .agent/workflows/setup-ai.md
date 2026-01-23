---
description: Setup and verify local Ollama AI
---

# Local AI Setup Workflow

## Prerequisites

1. Install Ollama from https://ollama.com/download
2. Start the Ollama server: `ollama serve`

## Commands

// turbo-all

### Basic Setup

```bash
bun setup:ai
```

### Specify a Different Model

```bash
bun setup:ai --model mistral
bun setup:ai --model codellama
bun setup:ai --model llama3:8b
```

### Diagnose Connection Issues

```bash
bun setup:ai --diagnose
```

### Show Help

```bash
bun setup:ai --help
```

## Popular Models for Release Notes

| Model        | Size  | Speed | Quality      |
| ------------ | ----- | ----- | ------------ |
| `llama3`     | 4.7GB | Fast  | Good         |
| `llama3:70b` | 40GB  | Slow  | Excellent    |
| `mistral`    | 4.1GB | Fast  | Good         |
| `codellama`  | 3.8GB | Fast  | Code-focused |

## Troubleshooting

1. **Connection refused**: Make sure `ollama serve` is running
2. **Model not found**: Run `ollama pull <model-name>`
3. **Remote server**: Set `OLLAMA_HOST` and `OLLAMA_PORT` env vars
