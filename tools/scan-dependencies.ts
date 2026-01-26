import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

// Config
const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_JSONS = [
    'package.json',
    'apps/desktop/package.json',
    'packages/style/package.json'
];

// Helper to read file content safely
function readFile(p: string): string {
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

async function scanPackage(pkgPath: string) {
    const fullPkgPath = path.join(ROOT_DIR, pkgPath);
    console.log(`\n📦 Scanning: ${pkgPath}`);

    if (!fs.existsSync(fullPkgPath)) {
        console.error(`Error: ${pkgPath} not found.`);
        return;
    }

    const pkg = JSON.parse(readFile(fullPkgPath));
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    const allDeps = [...deps, ...devDeps];

    if (allDeps.length === 0) {
        console.log("   No dependencies found.");
        return;
    }

    // Define search scope based on package location
    const pkgDir = path.dirname(fullPkgPath);

    // Glob patterns to search for usage
    // We look in src, lib, tools, scripts, and root config files if specific
    const searchPatterns = [
        '**/*.{ts,tsx,js,jsx,mjs,cjs,vue,svelte}',
        'vite.config.*',
        'vitest.config.*',
        'tailwind.config.*',
        'tsconfig*.json',
        '.eslintrc*',
        '.prettierrc*'
    ];

    // Collect all source content
    const files = glob.sync(searchPatterns, {
        cwd: pkgDir,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.turbo/**'],
        absolute: true,
        dot: true
    });

    // Also check root config files if we are in a sub-package (monorepo context)
    // Dependencies might be used in root configs but installed in workspace?? 
    // Usually opposite. Let's stick to local package scope + root config references?
    // Actually, simply checking the package directory recursively is usually enough.

    let allContent = '';
    // Append package.json scripts to content (binaries usage)
    if (pkg.scripts) {
        allContent += JSON.stringify(pkg.scripts) + '\n';
    }

    // Read all files
    console.log(`   Scanning ${files.length} files for usage references...`);
    for (const file of files) {
        allContent += readFile(file) + '\n';
    }

    const unused: string[] = [];

    for (const dep of allDeps) {
        // 1. Strict Import Check: "from 'dep'" or "require('dep')"
        // We optimize by checking if the string literal exists.
        // We check for:
        // 'dep'
        // "dep"
        // 'dep/
        // "dep/

        // Simple heuristic: Does the package name appear in the code?
        // This is "Double Verify" strategy from previous steps.
        // If "react" appears, it's used.
        // False positive risk: comments. But better to keep than delete.

        const isTypes = dep.startsWith('@types/');
        const searchName = isTypes ? dep.replace('@types/', '') : dep;

        // For types, we check if the base name is used OR the type pkg name is used (e.g. tsconfig)
        const isUsed = allContent.includes(dep) || (isTypes && allContent.includes(searchName));

        if (!isUsed) {
            // Special handling for known "magic" packages
            // e.g. "typescript", "vite", these might be used implicitly by run commands not in scripts?
            // "rimraf" -> often in scripts. checked above.
            unused.push(dep);
        }
    }

    if (unused.length > 0) {
        console.log(`   ⚠️  Potentially Unused (${unused.length}):`);
        unused.forEach(d => console.log(`      - ${d}`));
    } else {
        console.log("   ✅ All dependencies appear to be used.");
    }
}

async function main() {
    for (const p of PACKAGE_JSONS) {
        await scanPackage(p);
    }
}

main().catch(console.error);
