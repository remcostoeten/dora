#!/usr/bin/env node
import { existsSync } from 'node:fs'
import path from 'node:path'
import { renderScene } from './runner.mjs'
import { listScenes, loadScene, sceneFilePath } from './scene-io.mjs'

function parseArgs(argv) {
	const out = { flags: {}, positional: [] }
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]
		if (a.startsWith('--')) {
			const key = a.slice(2)
			const next = argv[i + 1]
			if (next && !next.startsWith('--')) {
				out.flags[key] = next
				i++
			} else {
				out.flags[key] = true
			}
		} else {
			out.positional.push(a)
		}
	}
	return out
}

function printHelp() {
	console.log('Available scenes:')
	for (const s of listScenes()) console.log('  -', s)
	console.log('\nUsage:')
	console.log('  dora-promo <scene> [--gif] [--captions] [--out <dir>] [--base <url>] [--headed]')
	console.log(
		'  dora-promo author <name> [--view <v>] [--connection <c>] [--table <t>] [--mode sql|drizzle|prisma] [--base <url>]'
	)
	console.log('  dora-promo edit <name>')
	console.log('  dora-promo --list')
}

async function runAuthor(positional, flags) {
	const name = positional[1]
	if (!name) {
		console.error('Usage: dora-promo author <name> [--view --connection --table --mode]')
		process.exit(1)
	}
	if (existsSync(sceneFilePath(name))) {
		console.error(`Scene "${name}" already exists. Use "edit" to change it.`)
		process.exit(1)
	}
	const { authorScene } = await import('./author.mjs')
	const file = await authorScene(name, {
		base: flags.base ? String(flags.base) : undefined,
		view: flags.view ? String(flags.view) : undefined,
		connection: flags.connection ? String(flags.connection) : undefined,
		table: flags.table ? String(flags.table) : undefined,
		mode: flags.mode ? String(flags.mode) : undefined
	})
	if (file) console.log(`\n[promo] author it again with: dora-promo edit ${name}`)
}

async function runEdit(positional) {
	const name = positional[1]
	if (!name || !existsSync(sceneFilePath(name))) {
		console.error(`Scene "${name || ''}" not found. Run with --list to see scenes.`)
		process.exit(1)
	}
	const { editScene } = await import('./edit.mjs')
	await editScene(name)
}

async function runRender(positional, flags) {
	const name = positional[0]
	if (!existsSync(sceneFilePath(name))) {
		console.error(`Scene "${name}" not found. Run with --list to see scenes.`)
		process.exit(1)
	}
	const scene = await loadScene(name)
	const outDir = flags.out
		? path.resolve(String(flags.out))
		: path.resolve(process.cwd(), 'promo-out')

	console.log(`[promo] rendering scene "${name}" -> ${outDir}`)
	const result = await renderScene(scene, {
		outDir,
		base: flags.base ? String(flags.base) : undefined,
		gif: !!flags.gif,
		captions: !!flags.captions,
		headless: !flags.headed
	})

	console.log('\n[promo] done')
	console.log('  mp4:', result.mp4)
	if (result.gif) console.log('  gif:', result.gif)
	if (!result.ok) {
		console.log('  (final editor value did not match scene.expect — see warning above)')
		process.exitCode = 2
	}
}

async function main() {
	const { flags, positional } = parseArgs(process.argv.slice(2))

	if (flags.list || (positional.length === 0 && !flags.help)) {
		printHelp()
		return
	}

	const cmd = positional[0]
	if (cmd === 'author' || cmd === 'new') return runAuthor(positional, flags)
	if (cmd === 'edit') return runEdit(positional)
	return runRender(positional, flags)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
