import { defineConfig } from 'oxfmt'

export default defineConfig({
    printWidth: 80,
    tabWidth: 4,
    useTabs: false,
    semi: false,
    singleQuote: true,
    trailingComma: 'none',
    endOfLine: 'lf',
    insertFinalNewline: true,
    sortImports: false,
    sortTailwindcss: false,
    sortPackageJson: false,
    ignorePatterns: [
        '.next/**',
        'node_modules/**',
        'coverage/**',
        'dist/**',
        'next-env.d.ts'
    ],
    overrides: [
        {
            files: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
            options: {
                printWidth: 120
            }
        },
        {
            files: ['**/*.{md,html}'],
            options: {
                tabWidth: 4
            }
        }
    ]
})
