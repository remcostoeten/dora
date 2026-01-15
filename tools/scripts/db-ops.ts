import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { colors, log, logLevel, logHeader, logKeyValue } from "./_shared";


const DB_PATHS = [
    path.join(process.cwd(), "apps/desktop/src-tauri/data/dora.db"),
    path.join(process.cwd(), "dora.db"),
    path.join(process.env.HOME || "", ".config/dora/dora.db")
];

const BACKUP_DIR = path.join(process.cwd(), "backups");


function findDbPath(): string | undefined {
    return DB_PATHS.find(fs.existsSync);
}

function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

function getTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, "-");
}



function backup() {
    logHeader("Database Backup");
    const dbPath = findDbPath();
    if (!dbPath) {
        logLevel("error", "Database not found in standard locations.");
        return;
    }

    ensureBackupDir();
    const filename = `dora_backup_${getTimestamp()}.db`;
    const dest = path.join(BACKUP_DIR, filename);

    try {
        fs.copyFileSync(dbPath, dest);
        logLevel("success", "Backup created successfully!");
        logKeyValue("Source", dbPath);
        logKeyValue("Destination", dest);
    } catch (e) {
        logLevel("error", `Backup failed: ${e}`);
    }
}

function dump() {
    logHeader("Database Dump (SQL)");
    const dbPath = findDbPath();
    if (!dbPath) {
        logLevel("error", "Database not found.");
        return;
    }

    try {
        // Try using sqlite3 CLI
        const dump = execSync(`sqlite3 "${dbPath}" .dump`).toString();

        ensureBackupDir();
        const filename = `dora_dump_${getTimestamp()}.sql`;
        const dest = path.join(BACKUP_DIR, filename);

        fs.writeFileSync(dest, dump);

        logLevel("success", "Database dumped successfully!");
        logKeyValue("File", dest);
        logKeyValue("Size", `${(dump.length / 1024).toFixed(2)} KB`);
    } catch (e) {
        logLevel("error", "Failed to dump database. Ensure 'sqlite3' is installed.");
        console.error(e);
    }
}

function reset() {
    logHeader("Database Reset");
    const dbPath = findDbPath();
    if (!dbPath) {
        logLevel("warning", "No database found to reset.");
        return;
    }

    log("⚠️  WARNING: This will DELETE the current database.", colors.red);
    log("A new empty database will be created next time you start the app.", colors.yellow);

    // Backup first just in case
    log("\nCreating safety backup first...", colors.blue);
    backup();

    try {
        fs.unlinkSync(dbPath);
        logLevel("success", "\nDatabase deleted.");
        log("Please restart the Desktop App to re-initialize and migrate.", colors.cyan);
    } catch (e) {
        logLevel("error", `Failed to delete database: ${e}`);
    }
}

function introspect() {
    logHeader("Database Info");
    const dbPath = findDbPath();
    if (!dbPath) {
        log("Status: Not Found", colors.red);
        return;
    }

    const stats = fs.statSync(dbPath);
    logKeyValue("Status", "Found");
    logKeyValue("Path", dbPath);
    logKeyValue("Size", `${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    logKeyValue("Modified", stats.mtime.toLocaleString());

    try {
        const tables = execSync(`sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"`)
            .toString()
            .split("\n")
            .filter(Boolean)
            .join(", ");

        logKeyValue("Tables", tables || "None");
    } catch (e) {
        log("Could not list tables (sqlite3 CLI not found or error)", colors.gray);
    }
}


const args = process.argv.slice(2);

if (args.includes("--backup")) backup();
else if (args.includes("--dump")) dump();
else if (args.includes("--reset")) reset();
else if (args.includes("--introspect")) introspect();
else {
    console.log(`
${colors.bold}Usage:${colors.reset} bun db:ops [command]

${colors.bold}Commands:${colors.reset}
  --backup      Copy current DB to backups/
  --dump        Export SQL dump to backups/
  --reset       Delete DB (triggers migration on app restart)
  --introspect  Show DB file info and tables
`);
}
