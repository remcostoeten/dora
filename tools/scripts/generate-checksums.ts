import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'
import { logHeader, logKeyValue, logLevel } from './_shared'

type Config = {
	inputDir: string
	output: string
	extensions: Set<string>
}

function getFlagValue(flag: string): string | undefined {
	const prefix = `--${flag}=`
	const arg = process.argv.find((value) => value.startsWith(prefix))
	return arg ? arg.slice(prefix.length) : undefined
}

function requireFlag(flag: string): string {
	const value = getFlagValue(flag)
	if (!value) {
		throw new Error(`Missing required flag --${flag}=...`)
	}
	return value
}

function normalizeExtension(value: string): string {
	return value.startsWith('.') ? value.toLowerCase() : `.${value.toLowerCase()}`
}

function collectFiles(dir: string): string[] {
	const entries = fs.readdirSync(dir, { withFileTypes: true })
	const files: string[] = []

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			files.push(...collectFiles(fullPath))
			continue
		}

		files.push(fullPath)
	}

	return files
}

function hashFile(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = createHash('sha256')
		const stream = fs.createReadStream(filePath)

		stream.on('data', (chunk) => hash.update(chunk))
		stream.on('end', () => resolve(hash.digest('hex').toUpperCase()))
		stream.on('error', reject)
	})
}

async function main() {
	const extensionsArg = getFlagValue('extensions')
	const config: Config = {
		inputDir: path.resolve(requireFlag('input-dir')),
		output: path.resolve(requireFlag('output')),
		extensions: new Set(
			(extensionsArg || '.AppImage,.deb,.dmg,.exe,.msi,.rpm')
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean)
				.map(normalizeExtension)
		)
	}

	if (!fs.existsSync(config.inputDir)) {
		throw new Error(`Input directory does not exist: ${config.inputDir}`)
	}

	const files = collectFiles(config.inputDir)
		.filter((filePath) => config.extensions.has(path.extname(filePath).toLowerCase()))
		.sort((left, right) => left.localeCompare(right))

	if (files.length === 0) {
		throw new Error(`No matching files found in ${config.inputDir}`)
	}

	logHeader('Generating Checksums')
	logKeyValue('Input', config.inputDir)
	logKeyValue('Output', config.output)
	logKeyValue('Extensions', [...config.extensions].join(', '))

	const lines: string[] = []

	for (const filePath of files) {
		const digest = await hashFile(filePath)
		const relativePath = path.relative(config.inputDir, filePath).split(path.sep).join('/')
		lines.push(`${digest}  ${relativePath}`)
		logLevel('info', `Hashed ${relativePath}`)
	}

	fs.mkdirSync(path.dirname(config.output), { recursive: true })
	fs.writeFileSync(config.output, `${lines.join('\n')}\n`)
	logLevel('success', `Wrote ${files.length} checksum entries`)
}

main().catch((error) => {
	logLevel('error', error instanceof Error ? error.message : String(error))
	process.exit(1)
})
