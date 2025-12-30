const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for prettier output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

const inputFile = process.argv[2];

console.log(`${colors.cyan}${colors.bold}🎨 Tauri Icon Generator Wrapper${colors.reset}\n`);

if (!inputFile) {
    console.error(`${colors.red}Error: No input file provided.${colors.reset}`);
    console.log(`\n${colors.yellow}Usage:${colors.reset}`);
    console.log(`  npm run generate:icons -- <path-to-image>`);
    console.log(`\n${colors.yellow}Example:${colors.reset}`);
    console.log(`  npm run generate:icons -- ./assets/logo.svg`);
    console.log(`  npm run generate:icons -- ./design/app-icon.png`);
    console.log(`\n${colors.cyan}Supported formats depending on Tauri version: PNG, SVG (recommended), etc.${colors.reset}`);
    process.exit(1);
}

const absoluteInputPath = path.resolve(process.cwd(), inputFile);

if (!fs.existsSync(absoluteInputPath)) {
    console.error(`${colors.red}Error: File not found at path: ${absoluteInputPath}${colors.reset}`);
    process.exit(1);
}

const validExtensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
const ext = path.extname(inputFile).toLowerCase();

if (!validExtensions.includes(ext)) {
    console.warn(`${colors.yellow}Warning: Extension '${ext}' might not be fully supported by the underlying Tauri CLI. PNG (1024x1024) is recommended.${colors.reset}`);
}

console.log(`${colors.green}Found input file:${colors.reset} ${inputFile}`);
console.log(`${colors.cyan}Running Tauri icon generation...${colors.reset}`);

try {
    // Execute the tauri icon command
    // We point it to src-tauri if that's where tauri.conf.json is, but usually running 'tauri icon' in project root works if tauri.conf.json is found or if it defaults correctly.
    // The 'tauri' script in package.json runs 'tauri', so we use 'npm run tauri -- icon'.

    execSync(`npm run tauri -- icon "${inputFile}"`, { stdio: 'inherit' });

    console.log(`\n${colors.green}${colors.bold}✅ Icons generated successfully!${colors.reset}`);
    console.log(`Check ${colors.cyan}src-tauri/icons${colors.reset} for the output.`);
} catch (error) {
    console.error(`\n${colors.red}${colors.bold}❌ Failed to generate icons.${colors.reset}`);
    console.error('Make sure you have the necessary dependencies installed and the input file is valid.');
    process.exit(1);
}
