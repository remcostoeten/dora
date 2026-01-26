import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

// Config
const TARGET_DIR = path.resolve(__dirname, '../apps/desktop/src');
const SEARCH_ROOT = path.resolve(__dirname, '../apps/desktop/src'); // Scope for references
const EXCLUSIONS = [
    'index.ts', 'index.tsx', '.test.', '.spec.', '.css', '.scss',
    'vite-env.d.ts', 'main.tsx', 'App.tsx'
];

async function main() {
    console.log(`🔎 Scanning for unused files in: ${TARGET_DIR}`);

    // 1. Get all files in src
    const files = glob.sync('**/*.{ts,tsx}', { cwd: TARGET_DIR, absolute: true });
    console.log(`Found ${files.length} files in src.`);

    // 2. Read all files in the Search Root to find references
    const allSourceFiles = glob.sync('**/*.{ts,tsx}', { cwd: SEARCH_ROOT, absolute: true });
    let allContent = '';

    for (const file of allSourceFiles) {
        allContent += fs.readFileSync(file, 'utf-8') + '\n';
    }

    // 3. Check each file
    const unusedFiles: string[] = [];

    for (const file of files) {
        const filename = path.basename(file);
        const basenameNoExt = path.basename(file, path.extname(file));
        const relativePath = path.relative(TARGET_DIR, file);

        // Skip exclusions
        if (EXCLUSIONS.some(ex => filename.includes(ex))) continue;

        // Skip Pages (Entry points)
        if (relativePath.startsWith('pages/')) continue;

        // Skip specific config/entry files
        if (filename === 'layout.tsx' || filename === 'page.tsx') continue;

        // Skip Features (Already audited, but re-scanning is fine -
        // actually let's skip features if we want to focus on the rest,
        // OR just scan everything. Let's scan everything for completeness.)

        // Check strict import references (simplified text search for basename)
        // We search for "basename" to catch imports like: import { X } from './basename'
        // This is safe-ish because if 'basename' is common word, we assume used.
        // We want to find UNUSED, so if we don't find it, it's definitely unused.

        // Regex for import paths? No, simple text search is robust "double-verify".
        // If the filename (no ext) appears in the codebase, we assume it MIGHT be used.
        // We check if it appears MORE than once (once is the definition itself, if inside the checked dir?
        // Wait, we concatenated ALL content. So the definition file content is in there.

        // Refined strategy:
        // Search in all OTHER files.

        let isUsed = false;
        for (const sourceFile of allSourceFiles) {
            if (sourceFile === file) continue; // Don't check self

            const content = fs.readFileSync(sourceFile, 'utf-8');

            // Check for strict import path parts or import names
            // Simplest: Check if the filename (without extension) exists in content
            if (content.includes(basenameNoExt)) {
                isUsed = true;
                break;
            }
        }

        if (!isUsed) {
            // Fallback: Check Global (Project Root - e.g. for dynamic or cross-package)
            // For now, let's stick to Desktop scope as per plan, but flag "Suspicious".
            console.log(`[UNUSED?] ${relativePath}`);
            unusedFiles.push(relativePath); // Store relative path for easier reading
        }
    }

    console.log(`\n📋 Potential Unused Files (${unusedFiles.length}):`);
    unusedFiles.forEach(f => console.log(f));
}

main().catch(console.error);
