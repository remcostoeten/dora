package main

type scriptDef struct {
	label       string
	description string
	command     string
	args        []string
	needsInput  bool
	inputPrompt string
	inputType   string // "model" | "version" | "text"
}

// ---------------------------------------------------------------------------
// Release: generate notes / version management
// ---------------------------------------------------------------------------

var releaseNotesScripts = []scriptDef{
	{
		label:       "Test API Connection",
		description: "Verify LLM providers (Gemini/Groq/Ollama)",
		command:     "bun",
		args:        []string{"run", "tools/scripts/generate-release.ts", "--test"},
	},
	{
		label:       "List Available Models",
		description: "Show available Gemini models",
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
		label:       "Generate Release Text (shell)",
		description: "Run generate-release-text.sh",
		command:     "bash",
		args:        []string{"scripts/generate-release-text.sh"},
	},
	{
		label:       "Sync Changelog Data",
		description: "Regenerate changelog JSON from git history",
		command:     "bun",
		args:        []string{"scripts/sync-changelog-data.ts"},
	},
	{
		label:       "Version Bump + Generate",
		description: "Bump version then generate release notes",
		command:     "bun",
		args:        []string{"run", "tools/scripts/generate-release.ts", "--version-bump="},
		needsInput:  true,
		inputPrompt: "Select version bump type",
		inputType:   "version",
	},
	{
		label:       "Full Release Script",
		description: "Run scripts/release.sh (full pipeline)",
		command:     "bash",
		args:        []string{"scripts/release.sh"},
	},
	{
		label:       "Release Guide",
		description: "Show interactive release guide",
		command:     "bash",
		args:        []string{"tools/scripts/release-guide.sh"},
	},
}

// ---------------------------------------------------------------------------
// Release: package/distro artifacts
// ---------------------------------------------------------------------------

var releasePackagingScripts = []scriptDef{
	{
		label:       "Generate Checksums",
		description: "SHA256 checksums for release artifacts",
		command:     "bun",
		args:        []string{"tools/scripts/generate-checksums.ts"},
	},
	{
		label:       "Generate WinGet Manifest",
		description: "Windows Package Manager manifest",
		command:     "bun",
		args:        []string{"tools/scripts/generate-winget-manifest.ts"},
	},
	{
		label:       "Generate AUR Package",
		description: "Arch User Repository PKGBUILD",
		command:     "bun",
		args:        []string{"tools/scripts/generate-aur-package.ts"},
	},
	{
		label:       "Sync AUR Repo",
		description: "Push updated AUR package to repo",
		command:     "bash",
		args:        []string{"tools/scripts/sync-aur-repo.sh"},
	},
	{
		label:       "Test AUR (Docker)",
		description: "Validate AUR package in clean Arch container",
		command:     "bash",
		args:        []string{"tools/scripts/test-aur-docker.sh"},
	},
	{
		label:       "Generate Homebrew Cask",
		description: "macOS Homebrew cask formula",
		command:     "bun",
		args:        []string{"tools/scripts/generate-homebrew-cask.ts"},
	},
	{
		label:       "Generate APT Repo",
		description: "Debian/Ubuntu APT repository metadata",
		command:     "bun",
		args:        []string{"tools/scripts/generate-apt-repo.ts"},
	},
	{
		label:       "Build Flatpak",
		description: "Build Flatpak bundle (packaging/flatpak/)",
		command:     "bash",
		args:        []string{"packaging/flatpak/build-flatpak.sh"},
	},
	{
		label:       "Build Snap",
		description: "snapcraft pack --use-lxd",
		command:     "snapcraft",
		args:        []string{"pack", "--use-lxd"},
	},
	{
		label:       "Build Snap (destructive)",
		description: "snapcraft pack --destructive-mode (requires sudo)",
		command:     "bash",
		args:        []string{"-c", "sudo /snap/bin/snapcraft pack --destructive-mode"},
	},
	{
		label:       "Update Snapcraft Secret",
		description: "Rotate snap store credentials",
		command:     "bash",
		args:        []string{"tools/scripts/update-snapcraft-secret.sh"},
	},
}

// ---------------------------------------------------------------------------
// AI setup
// ---------------------------------------------------------------------------

var aiSetupScripts = []scriptDef{
	{
		label:       "Setup Default Model",
		description: "Setup llama3 (default)",
		command:     "bun",
		args:        []string{"run", "tools/scripts/setup-local-ai.ts"},
	},
	{
		label:       "Setup Specific Model",
		description: "Choose which Ollama model to pull",
		command:     "bun",
		args:        []string{"run", "tools/scripts/setup-local-ai.ts", "--model"},
		needsInput:  true,
		inputPrompt: "Select model to setup",
		inputType:   "model",
	},
	{
		label:       "Diagnose Connection",
		description: "Check Ollama status and connectivity",
		command:     "bun",
		args:        []string{"run", "tools/scripts/setup-local-ai.ts", "--diagnose"},
	},
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

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
		description: "Delete current DB — re-migrates on next restart",
		command:     "bun",
		args:        []string{"run", "tools/scripts/db-ops.ts", "--reset"},
	},
}

// ---------------------------------------------------------------------------
// Dev tools / diagnostics
// ---------------------------------------------------------------------------

var devToolScripts = []scriptDef{
	{
		label:       "Audit Cleanup",
		description: "Find dead code / leftover files",
		command:     "bash",
		args:        []string{"tools/audit-cleanup.sh"},
	},
	{
		label:       "Scan Dependencies",
		description: "Analyse dependency usage across packages",
		command:     "bun",
		args:        []string{"tools/scan-dependencies.ts"},
	},
	{
		label:       "Scan Unused",
		description: "Report unused exports / imports",
		command:     "bun",
		args:        []string{"tools/scan-unused.ts"},
	},
	{
		label:       "Diagnose Tauri Dev",
		description: "Debug tauri dev startup issues",
		command:     "bash",
		args:        []string{"tools/diagnose-tauri-dev.sh"},
	},
	{
		label:       "VM Lab",
		description: "Interactive VM lab script",
		command:     "bash",
		args:        []string{"tools/scripts/vm-lab.sh"},
	},
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

var testScripts = []scriptDef{
	{
		label:       "Run All Tests (turbo)",
		description: "vitest across all packages via turbo",
		command:     "bun",
		args:        []string{"run", "test"},
	},
	{
		label:       "Watch Mode",
		description: "vitest in watch mode",
		command:     "bun",
		args:        []string{"run", "test:watch"},
	},
	{
		label:       "Test UI",
		description: "vitest with browser UI",
		command:     "bun",
		args:        []string{"run", "test:ui"},
	},
	{
		label:       "Coverage Report",
		description: "vitest run --coverage",
		command:     "bun",
		args:        []string{"run", "test:coverage"},
	},
	{
		label:       "Desktop Tests Only",
		description: "vitest scoped to apps/desktop",
		command:     "bun",
		args:        []string{"run", "test:desktop"},
	},
}

// ---------------------------------------------------------------------------
// Lint / format
// ---------------------------------------------------------------------------

var lintScripts = []scriptDef{
	{
		label:       "Lint",
		description: "oxlint across packages/style",
		command:     "bun",
		args:        []string{"run", "lint"},
	},
	{
		label:       "Lint + Fix",
		description: "Auto-fix lint issues",
		command:     "bun",
		args:        []string{"run", "lint:fix"},
	},
	{
		label:       "Format Check",
		description: "oxfmt dry-run",
		command:     "bun",
		args:        []string{"run", "format"},
	},
	{
		label:       "Format + Fix",
		description: "Apply oxfmt formatting",
		command:     "bun",
		args:        []string{"run", "format:fix"},
	},
	{
		label:       "Fix All",
		description: "lint:fix + format:fix combined",
		command:     "bun",
		args:        []string{"run", "fix"},
	},
}

// ---------------------------------------------------------------------------
// Marketing SEO
// ---------------------------------------------------------------------------

var seoScripts = []scriptDef{
	{
		label:       "Run SEO Audit",
		description: "Run full SEO audit against local dev",
		command:     "bash",
		args:        []string{"-c", "bun --cwd apps/marketing run seo"},
	},
	{
		label:       "Setup SEO CI",
		description: "Install SEO audit dependencies",
		command:     "bash",
		args:        []string{"-c", "bun --cwd apps/marketing run seo:setup"},
	},
	{
		label:       "SEO Audit (prod)",
		description: "Run audit against production URL",
		command:     "bash",
		args:        []string{"-c", "bun --cwd apps/marketing run seo:prod"},
	},
	{
		label:       "Build + Audit",
		description: "Next.js build then post-build SEO audit",
		command:     "bash",
		args:        []string{"-c", "bun --cwd apps/marketing run build"},
	},
}

// ---------------------------------------------------------------------------
// CI dispatch
// ---------------------------------------------------------------------------

type ciWorkflow struct {
	label       string
	description string
	workflow    string
}

var ciWorkflows = []ciWorkflow{
	{label: "macOS CI", description: "Build and test on macOS runner", workflow: "ci-mac.yml"},
	{label: "Linux CI", description: "Main CI pipeline", workflow: "ci.yml"},
	{label: "Release", description: "Full release pipeline", workflow: "release.yml"},
	{label: "Tag Create", description: "Create and push a version tag", workflow: "tag-create.yml"},
	{label: "APT repo", description: "Publish to APT repository", workflow: "apt.yml"},
	{label: "AUR", description: "Push to Arch User Repository", workflow: "aur.yml"},
	{label: "Homebrew", description: "Update Homebrew cask", workflow: "brew.yml"},
	{label: "Flatpak", description: "Build and publish Flatpak", workflow: "flatpak.yml"},
	{label: "Snap", description: "Build and publish Snap", workflow: "snap.yml"},
	{label: "WinGet", description: "Submit to Windows Package Manager", workflow: "winget.yml"},
}

// ---------------------------------------------------------------------------
// Pickers
// ---------------------------------------------------------------------------

var versionBumpOptions = []string{"patch", "minor", "major"}

var popularModels = []string{
	"llama3",
	"llama3:70b",
	"mistral",
	"codellama",
	"gemma2",
	"phi3",
	"deepseek-coder",
}
