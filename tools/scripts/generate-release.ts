import { GoogleGenerativeAI } from "@google/generative-ai";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import readline from "readline";
import { Database } from "sqlite3";
import { colors, log, logLevel, logHeader, logKeyValue } from "./_shared";

// --- CLI Argument Parsing ---
function hasFlag(flag: string): boolean {
    return process.argv.includes(`--${flag}`) || process.argv.includes(`-${flag.charAt(0)}`);
}

function getFlagValue(flag: string): string | undefined {
    const fullFlag = `--${flag}=`;
    const arg = process.argv.find(function (a) { return a.startsWith(fullFlag); });
    return arg ? arg.substring(fullFlag.length) : undefined;
}

// --- App Storage Integration ---
function getApiKeyFromStorage(): Promise<string | undefined> {
    return new Promise((resolve) => {
        const dbPath = path.join(process.cwd(), "apps/desktop/src-tauri/data/dora.db"); // Assuming default location
        // Try multiple potential paths for the DB if default fails
        const paths = [
            path.join(process.cwd(), "apps/desktop/src-tauri/data/dora.db"),
            path.join(process.cwd(), "dora.db"),
            path.join(process.env.HOME || "", ".config/dora/dora.db")
        ];

        // Find first existing db
        const validPath = paths.find(fs.existsSync);

        if (!validPath) {
            resolve(undefined);
            return;
        }

        const db = new Database(validPath, (err: Error | null) => {
            if (err) {
                resolve(undefined);
                return;
            }
        });

        db.get("SELECT value FROM app_settings WHERE key = 'gemini_api_key'", (err: Error | null, row: any) => {
            db.close();
            if (err || !row) {
                resolve(undefined);
            } else {
                resolve(row.value);
            }
        });
    });
}

const CONFIG = {
    apiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    ollamaModel: process.env.OLLAMA_MODEL || "llama3",
    provider: (process.env.LLM_PROVIDER || "gemini") as "gemini" | "ollama",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/api/generate",
    packageJsonPath: path.join(process.cwd(), "apps/desktop/package.json"),
    releaseNotesPath: path.join(process.cwd(), "RELEASE_NOTES.md"),
    changelogPath: path.join(process.cwd(), "CHANGELOG.md"),
};

// --- Version Bumping ---
function bumpVersion(version: string, type: "major" | "minor" | "patch"): string {
    const parts = version.split(".").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        log(`Invalid version format: ${version}`, colors.red);
        return version;
    }
    switch (type) {
        case "major": return `${parts[0] + 1}.0.0`;
        case "minor": return `${parts[0]}.${parts[1] + 1}.0`;
        case "patch": return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    }
}

function updatePackageVersion(newVersion: string): void {
    try {
        const pkg = JSON.parse(fs.readFileSync(CONFIG.packageJsonPath, "utf-8"));
        pkg.version = newVersion;
        fs.writeFileSync(CONFIG.packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
        logLevel("success", `Updated package.json to v${newVersion}`);
    } catch (e) {
        log(`Error updating package.json: ${e}`, colors.red);
    }
}

function getLatestTag(): string {
    try {
        return execSync("git describe --tags --abbrev=0").toString().trim();
    } catch (e) {
        log("No tags found. collecting all commits.", colors.yellow);
        return "";
    }
}

function getCommits(sinceTag: string): string {
    const range = sinceTag ? `${sinceTag}..HEAD` : "HEAD";
    const format = "%h|%an|%ad|%s";
    try {
        return execSync(`git log "${range}" --pretty=format:"${format}" --date=short`).toString();
    } catch (e) {
        log(`Error getting commits: ${e}`, colors.red);
        return "";
    }
}

function getCurrentVersion(): string {
    try {
        const pkg = JSON.parse(fs.readFileSync(CONFIG.packageJsonPath, "utf-8"));
        return pkg.version;
    } catch (e) {
        log(`Error reading package.json: ${e}`, colors.red);
        return "0.0.0";
    }
}

// --- Interaction ---

async function askQuestion(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(`${colors.cyan}${query}${colors.reset} `, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

const SYSTEM_PROMPT = `
You are an expert release manager. Analyze the git commits and generate structured release content.

<output_format>
You MUST respond with ONLY valid JSON in this exact structure:
{
  "releaseNotes": "# Version X.X.X\n\n## Features\n- Feature description\n\n## Bug Fixes\n- Fix description\n\n## Other Changes\n- Other changes",
  "changelogEntry": {
    "title": "Short catchy title (max 50 chars)",
    "description": "One sentence summary describing the main changes.",
    "type": "feature"
  }
}
</output_format>

<rules>
1. Group commits by type: Features, Bug Fixes, Refactors, Breaking Changes
2. Use bullet points for individual changes
3. Keep descriptions concise and user-focused (not developer-focused)
4. Infer the changelogEntry.type based on the majority of changes:
   - "feature" = mostly new features
   - "fix" = mostly bug fixes
   - "refactor" = mostly code improvements
   - "breaking" = contains breaking changes
5. The title should be catchy and marketing-friendly
6. Remove merge commits and trivial changes from the notes
7. DO NOT include any text outside the JSON structure
</rules>

<example_output>
{
  "releaseNotes": "# Version 1.2.0\n\n## Features\n- Added dark mode support with system preference detection\n- New keyboard shortcuts for power users\n\n## Bug Fixes\n- Fixed crash when opening large databases\n- Resolved memory leak in query editor\n\n## Other Changes\n- Improved startup performance by 40%",
  "changelogEntry": {
    "title": "Dark Mode & Performance Boost",
    "description": "This release adds dark mode support and significantly improves startup performance.",
    "type": "feature"
  }
}
</example_output>
`;

// --- LLM Providers ---

async function listGeminiModels() {
    if (!CONFIG.apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${CONFIG.apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to list models: ${response.statusText}`);
        const data = await response.json() as any;
        log("Available Gemini Models:", colors.blue);
        data.models?.forEach((m: any) => {
            if (m.supportedGenerationMethods?.includes("generateContent")) {
                console.log(`- ${m.name.replace('models/', '')} (${m.displayName})`);
            }
        });
    } catch (e) {
        console.error("Error listing models:", e);
    }
}


function cleanJson(text: string): string {
    // Remove markdown code blocks if present
    let cleaned = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    // Try to find the first '{' and last '}' to strip surrounding text
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return cleaned;
}

async function generateWithGemini(prompt: string): Promise<string> {
    if (!CONFIG.apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }
    const genAI = new GoogleGenerativeAI(CONFIG.apiKey);
    const model = genAI.getGenerativeModel({ model: CONFIG.geminiModel });

    if (process.argv.includes("--test-only") || process.argv.includes("--test")) {
        const result = await model.generateContent("Test connection. Reply with 'OK'.");
        return result.response.text();
    }

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\n" + prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    });
    return cleanJson(result.response.text());
}

async function generateWithOllama(prompt: string): Promise<string> {
    if (process.argv.includes("--test-only") || process.argv.includes("--test")) {
        const body = {
            model: CONFIG.ollamaModel,
            prompt: "Test connection. Reply with 'OK'.",
            stream: false
        };
        const response = await fetch(CONFIG.ollamaBaseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`Ollama Error: ${response.statusText}`);
        const data = await response.json() as any;
        return data.response;
    }

    const body = {
        model: CONFIG.ollamaModel,
        prompt: SYSTEM_PROMPT + "\n" + prompt,
        stream: false,
        format: "json"
    };

    const response = await fetch(CONFIG.ollamaBaseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Ollama Error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return cleanJson(data.response);
}

// --- Main ---

async function main() {
    const isDryRun = hasFlag("dry-run");
    const versionBumpType = getFlagValue("version-bump") as "major" | "minor" | "patch" | undefined;

    if (hasFlag("help") || hasFlag("h")) {
        console.log(`
${colors.bold}Usage:${colors.reset} bun release:gen [options]

${colors.bold}Options:${colors.reset}
  --test              Test the API connection and model availability
  --dry-run           Preview generated content without saving to files
  --version-bump=TYPE Bump version before generating (major|minor|patch)
  --build             Build the Tauri executable after generating notes
  --list-models       List available models (Gemini only)
  --help, -h          Show this help message

${colors.bold}Environment Variables:${colors.reset}
  GEMINI_API_KEY   Your Google Gemini API key
  GEMINI_MODEL     Model name (default: gemini-2.0-flash)
  LLM_PROVIDER     'gemini' or 'ollama' (default: gemini)
  OLLAMA_MODEL     Ollama model name (default: llama3)

${colors.bold}Examples:${colors.reset}
  bun release:gen --test               # Test API connection
  bun release:gen --dry-run            # Preview without saving
  bun release:gen --version-bump=patch # Bump patch version and generate
        `);
        process.exit(0);
    }

    // --- Early API Key Validation ---
    if (CONFIG.provider === "gemini" && !CONFIG.apiKey) {
        log("Checking app storage for API key...", colors.blue);
        const storedKey = await getApiKeyFromStorage();
        if (storedKey) {
            CONFIG.apiKey = storedKey;
            logLevel("success", "Found API key in app database!");
        } else {
            logLevel("error", "GEMINI_API_KEY is not set and not found in app storage.");
            log("Set it in your environment or create a .env file.", colors.yellow);
            log("See: tools/scripts/.env.example", colors.cyan);
            process.exit(1);
        }
    }

    if (hasFlag("list-models")) {
        await listGeminiModels();
        process.exit(0);
    }

    logKeyValue("Provider", CONFIG.provider.toUpperCase());
    if (CONFIG.provider === 'gemini') logKeyValue("Model", CONFIG.geminiModel);
    if (CONFIG.provider === 'ollama') logKeyValue("Model", CONFIG.ollamaModel);
    if (isDryRun) log("\n⚠️  DRY RUN MODE - No files will be modified\n", colors.yellow);

    // --- API Key / Connection Test ---
    if (hasFlag("test-only") || hasFlag("test")) {
        log(`Testing ${CONFIG.provider} connection...`, colors.cyan);
        try {
            let response = "";
            if (CONFIG.provider === "gemini") {
                response = await generateWithGemini("");
            } else {
                response = await generateWithOllama("");
            }
            logLevel("success", "Verification: SUCCESS");
            log(`Response: ${response}`, colors.reset);
            process.exit(0);
        } catch (error) {
            logLevel("error", "Verification: FAILED");
            console.error(error);
            process.exit(1);
        }
    }

    // --- Version Bump ---
    let currentVersion = getCurrentVersion();
    if (versionBumpType) {
        if (!["major", "minor", "patch"].includes(versionBumpType)) {
            logLevel("error", `Invalid version bump type: ${versionBumpType}`);
            log("Use: --version-bump=major|minor|patch", colors.yellow);
            process.exit(1);
        }
        const newVersion = bumpVersion(currentVersion, versionBumpType);
        log(`Bumping version: ${currentVersion} → ${newVersion}`, colors.cyan);
        if (!isDryRun) {
            updatePackageVersion(newVersion);
        }
        currentVersion = newVersion;
    }

    const LatestTag = getLatestTag();
    logKeyValue("Latest tag", LatestTag || "None");

    const commits = getCommits(LatestTag);
    if (!commits) {
        logLevel("warning", "No new commits found.");
        return;
    }
    logKeyValue("Commits to analyze", String(commits.split("\n").length));

    const prompt = `
  Current Version: ${currentVersion}
  Commits:
  ${commits}

  Please generate release notes and a changelog entry.
  `;

    try {
        let textResult = "";

        if (CONFIG.provider === "gemini") {
            textResult = await generateWithGemini(prompt);
        } else if (CONFIG.provider === "ollama") {
            textResult = await generateWithOllama(prompt);
        } else {
            throw new Error(`Unknown provider: ${CONFIG.provider}`);
        }

        let data;
        try {
            data = JSON.parse(textResult);
        } catch (e) {
            logLevel("error", "Failed to parse JSON response. Raw output:");
            console.log(textResult);
            return;
        }

        logHeader("Generated Content");
        console.log("\nRelease Notes Preview:\n");
        console.log(data.releaseNotes.substring(0, 500) + "...\n");
        console.log("Changelog Entry:\n");
        console.log(JSON.stringify(data.changelogEntry, null, 2));

        if (isDryRun) {
            logLevel("info", "Dry run complete. No files were modified.");
            return;
        }

        const save = await askQuestion("\nDo you want to save these changes to RELEASE_NOTES.md and CHANGELOG.md? (y/N)");
        if (save.toLowerCase() === 'y') {
            // Write RELEASE_NOTES.md
            fs.writeFileSync(CONFIG.releaseNotesPath, data.releaseNotes);
            logLevel("success", `Updated ${CONFIG.releaseNotesPath}`);

            // Append to CHANGELOG.md
            const changelogEntryMD = `\n## ${currentVersion} - ${data.changelogEntry.title}\n${data.changelogEntry.description}\n`;
            fs.appendFileSync(CONFIG.changelogPath, changelogEntryMD);
            logLevel("success", `Updated ${CONFIG.changelogPath}`);
        } else {
            logLevel("warning", "Skipped saving files.");
        }

        // --- Build Executables ---
        if (process.argv.includes("--build")) {
            const build = await askQuestion("\nDo you want to build the executables now? (y/N)");
            if (build.toLowerCase() === 'y') {
                log("\n--- Building Executables ---", colors.cyan);
                try {
                    execSync("bun desktop:build", { stdio: "inherit" });
                    log("Build completed successfully.", colors.green);
                } catch (error) {
                    log("Build failed.", colors.red);
                    process.exit(1);
                }
            } else {
                log("Skipping build.", colors.yellow);
            }
        }

    } catch (error) {
        console.error("Error generating content:", error);
    }
}

main();
