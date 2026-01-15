package main

// Script definitions for all tools available in the CLI

type scriptDef struct {
	label       string
	description string
	command     string
	args        []string
	needsInput  bool   // whether this script needs user input
	inputPrompt string // prompt to show for input
	inputType   string // "model" | "version" | "text"
}

// Release notes scripts
var releaseScripts = []scriptDef{
	{
		label:       "Test API Connection",
		description: "Verify LLM Providers (Gemini/Groq/Ollama)",
		command:     "bun",
		args:        []string{"run", "tools/scripts/generate-release.ts", "--test"},
	},
	{
		label:       "List Available Models",
		description: "Show available models (Gemini only)",
		command:     "bun",
		args:        []string{"run", "tools/scripts/generate-release.ts", "--list-models"},
	},
	{
		label:       "Preview Release Notes (Dry Run)",
		description: "Generate without saving files",
		command:     "bun",
		args:        []string{"run", "tools/scripts/generate-release.ts", "--dry-run"},
	},
	{
		label:       "Generate Release Notes",
		description: "Generate and save release notes",
		command:     "bun",
		args:        []string{"run", "tools/scripts/generate-release.ts"},
	},
	{
		label:       "Version Bump + Generate",
		description: "Bump version then generate notes",
		command:     "bun",
		args:        []string{"run", "tools/scripts/generate-release.ts", "--version-bump="},
		needsInput:  true,
		inputPrompt: "Select version bump type",
		inputType:   "version",
	},
	{
		label:       "Generate + Build Executable",
		description: "Full release: notes + build",
		command:     "bun",
		args:        []string{"run", "tools/scripts/generate-release.ts", "--build"},
	},
}

// AI setup scripts
var aiSetupScripts = []scriptDef{
	{
		label:       "Setup Default Model",
		description: "Setup llama3 (default)",
		command:     "bun",
		args:        []string{"run", "tools/scripts/setup-local-ai.ts"},
	},
	{
		label:       "Setup Specific Model",
		description: "Choose which model to setup",
		command:     "bun",
		args:        []string{"run", "tools/scripts/setup-local-ai.ts", "--model"},
		needsInput:  true,
		inputPrompt: "Select model to setup",
		inputType:   "model",
	},
	{
		label:       "Diagnose Connection",
		description: "Check Ollama status",
		command:     "bun",
		args:        []string{"run", "tools/scripts/setup-local-ai.ts", "--diagnose"},
	},
}

// DB operations
var dbScripts = []scriptDef{
	{
		label:       "Backup Database",
		description: "Copy dora.db to backups/",
		command:     "bun",
		args:        []string{"run", "tools/scripts/db-ops.ts", "--backup"},
	},
	{
		label:       "Dump SQL",
		description: "Export SQL dump to backups/",
		command:     "bun",
		args:        []string{"run", "tools/scripts/db-ops.ts", "--dump"},
	},
	{
		label:       "Introspect DB",
		description: "Show tables and size",
		command:     "bun",
		args:        []string{"run", "tools/scripts/db-ops.ts", "--introspect"},
	},
	{
		label:       "Reset Database (Danger)",
		description: "Delete current DB (re-migrates on restart)",
		command:     "bun",
		args:        []string{"run", "tools/scripts/db-ops.ts", "--reset"},
	},
}

// Version bump options
var versionBumpOptions = []string{"patch", "minor", "major"}

// Popular Ollama models
var popularModels = []string{
	"llama3",
	"llama3:70b",
	"mistral",
	"codellama",
	"gemma2",
	"phi3",
}
