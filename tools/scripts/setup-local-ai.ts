import { execSync } from "child_process";
import readline from "readline";
import { colors, log, logLevel, logHeader, logKeyValue } from "./_shared";

const cliModel = getFlagValue("model");
const CONFIG = {
    model: cliModel || process.env.OLLAMA_MODEL || "llama3",
    host: process.env.OLLAMA_HOST || "localhost",
    port: process.env.OLLAMA_PORT || "11434",
    get baseUrl() { return `http://${this.host}:${this.port}/api/generate`; },
    get listUrl() { return `http://${this.host}:${this.port}/api/tags`; },
    get versionUrl() { return `http://${this.host}:${this.port}/api/version`; },
};

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

function hasFlag(flag: string): boolean {
    return process.argv.includes(`--${flag}`) || process.argv.includes(`-${flag.charAt(0)}`);
}

function getFlagValue(flag: string): string | undefined {
    const fullFlag = `--${flag}`;
    const idx = process.argv.indexOf(fullFlag);
    if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("-")) {
        return process.argv[idx + 1];
    }
    const eqArg = process.argv.find(function (a) { return a.startsWith(fullFlag + "="); });
    return eqArg ? eqArg.substring(fullFlag.length + 1) : undefined;
}


function checkOllamaInstalled(): boolean {
    try {
        execSync("ollama --version", { stdio: "ignore" });
        return true;
    } catch (e) {
        return false;
    }
}

async function checkServerRunning(): Promise<boolean> {
    try {
        // Use /api/version for more reliable health check
        const response = await fetch(CONFIG.versionUrl);
        return response.ok;
    } catch (e) {
        return false;
    }
}

async function getServerVersion(): Promise<string> {
    try {
        const response = await fetch(CONFIG.versionUrl);
        if (!response.ok) return "unknown";
        const data = await response.json() as { version?: string };
        return data.version || "unknown";
    } catch (e) {
        return "unreachable";
    }
}


async function checkModelExists(modelName: string): Promise<boolean> {
    try {
        // Use API to check models instead of CLI to support remote instances
        const response = await fetch(CONFIG.listUrl);
        if (!response.ok) return false;

        const data = await response.json() as { models: { name: string }[] };
        return data.models.some(m => m.name.includes(modelName));
    } catch (e) {
        // Fallback to CLI if local
        if (CONFIG.host === 'localhost' || CONFIG.host === '127.0.0.1') {
            try {
                const output = execSync("ollama list").toString();
                return output.includes(modelName);
            } catch (CLIError) {
                return false;
            }
        }
        return false;
    }
}

function pullModel(modelName: string) {
    log(`Pulling model '${modelName}'... This may take a while.`, colors.cyan);

    // Only works if ollama is local CLI
    if (CONFIG.host === 'localhost' || CONFIG.host === '127.0.0.1') {
        try {
            execSync(`ollama pull ${modelName}`, { stdio: "inherit" });
            log(`\nSuccessfully pulled '${modelName}'.`, colors.green);
        } catch (e) {
            log(`Failed to pull model '${modelName}'.`, colors.red);
            process.exit(1);
        }
    } else {
        log(`Cannot pull model automatically on remote host. Please run 'ollama pull ${modelName}' on ${CONFIG.host}.`, colors.yellow);
        process.exit(1);
    }
}

async function verifyModel(modelName: string) {
    log(`Verifying '${modelName}'...`, colors.cyan);
    const body = {
        model: modelName,
        prompt: "Say 'Ready' if you are working.",
        stream: false
    };

    try {
        const response = await fetch(CONFIG.baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Ollama API returned ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        log("Verification response: " + data.response.trim(), colors.green);
        log("Setup complete! 🚀", colors.green);
    } catch (e: any) {
        log("Verification failed.", colors.red);
        console.error(e.message);

        if (e.cause?.code === 'ECONNREFUSED') {
            log(`\nCould not connect to Ollama at ${CONFIG.host}:${CONFIG.port}.`, colors.yellow);
            log("1. Make sure Ollama is running ('ollama serve').", colors.yellow);
            log("2. If running in Docker or WSL, check your networking.", colors.yellow);
            log("3. Ensure OLLAMA_HOST and OLLAMA_ORIGINS are configured to allow connections.", colors.yellow);
        }
        process.exit(1);
    }
}


async function runDiagnose() {
    logHeader("Ollama Diagnostic Report");

    console.log("");
    logKeyValue("Host", CONFIG.host);
    logKeyValue("Port", CONFIG.port);
    logKeyValue("Model", CONFIG.model);
    logKeyValue("Base URL", CONFIG.baseUrl);
    console.log("");

    // Step 1: CLI Check
    const isLocal = CONFIG.host === 'localhost' || CONFIG.host === '127.0.0.1';
    if (isLocal) {
        const cliInstalled = checkOllamaInstalled();
        if (cliInstalled) {
            logLevel("success", "Ollama CLI is installed");
        } else {
            logLevel("error", "Ollama CLI not found in PATH");
        }
    } else {
        logLevel("info", "Remote host - skipping CLI check");
    }

    // Step 2: Server Check
    const serverVersion = await getServerVersion();
    if (serverVersion !== "unreachable") {
        logLevel("success", `Server is reachable (v${serverVersion})`);
    } else {
        logLevel("error", `Server at ${CONFIG.host}:${CONFIG.port} is not reachable`);
        log("\nPossible fixes:", colors.yellow);
        log("  1. Start the server: ollama serve", colors.reset);
        log("  2. Check firewall settings", colors.reset);
        log("  3. Verify OLLAMA_HOST environment variable", colors.reset);
        return;
    }

    // Step 3: Model Check
    const modelExists = await checkModelExists(CONFIG.model);
    if (modelExists) {
        logLevel("success", `Model '${CONFIG.model}' is available`);
    } else {
        logLevel("warning", `Model '${CONFIG.model}' not found`);
        log(`  Run: ollama pull ${CONFIG.model}`, colors.cyan);
    }

    console.log("");
    logLevel("info", "Diagnosis complete");
}


async function main() {

    if (hasFlag("help") || hasFlag("h")) {
        console.log(`
${colors.bold}Usage:${colors.reset} bun setup:ai [options]

${colors.bold}Options:${colors.reset}
  --model <name>   Specify the Ollama model to use (default: llama3)
  --diagnose       Run diagnostic checks and report status
  --help, -h       Show this help message

${colors.bold}Environment Variables:${colors.reset}
  OLLAMA_MODEL    Model name (default: llama3)
  OLLAMA_HOST     Server host (default: localhost)
  OLLAMA_PORT     Server port (default: 11434)

${colors.bold}Examples:${colors.reset}
  bun setup:ai                     # Setup with default model
  bun setup:ai --model mistral     # Setup with mistral model
  bun setup:ai --diagnose          # Run diagnostics

${colors.bold}Popular Models:${colors.reset}
  llama3, llama3:70b, mistral, codellama, gemma2
        `);
        process.exit(0);
    }


    if (hasFlag("diagnose")) {
        await runDiagnose();
        process.exit(0);
    }

    logHeader("Local AI Setup (Ollama)");
    logKeyValue("Target", CONFIG.baseUrl);
    logKeyValue("Model", CONFIG.model);

    // Check CLI installation (only critical if running locally)
    if ((CONFIG.host === 'localhost' || CONFIG.host === '127.0.0.1')) {
        if (!checkOllamaInstalled()) {
            logLevel("error", "'ollama' is not installed or not in your PATH.");

            const shouldInstall = await askQuestion("\nDo you want to run the automatic installation? (Requires sudo) [y/N]");
            if (shouldInstall.toLowerCase() === 'y' || shouldInstall.toLowerCase() === 'yes') {
                log("\nRunning: curl -fsSL https://ollama.com/install.sh | sh", colors.cyan);
                try {
                    execSync("curl -fsSL https://ollama.com/install.sh | sh", { stdio: "inherit" });
                    logLevel("success", "Ollama installed successfully!");
                } catch (e) {
                    logLevel("error", "Installation failed.");
                    process.exit(1);
                }
            } else {
                log("Please install Ollama from https://ollama.com/download", colors.yellow);
                process.exit(1);
            }
        } else {
            logLevel("success", "Ollama is installed");
        }
    }

    // Check if server is reachable
    const isRunning = await checkServerRunning();
    if (!isRunning) {
        logLevel("warning", `Ollama server at ${CONFIG.host}:${CONFIG.port} seems down.`);
        if (CONFIG.host === 'localhost') {
            log("Run 'ollama serve' in a separate terminal.", colors.yellow);
        }
        process.exit(1);
    }
    logLevel("success", "Server is reachable");

    if (await checkModelExists(CONFIG.model)) {
        logLevel("success", `Model '${CONFIG.model}' is available`);
    } else {
        logLevel("warning", `Model '${CONFIG.model}' not found on server.`);
        pullModel(CONFIG.model);
    }

    await verifyModel(CONFIG.model);
}

main();
