/**
 * Regenerates the per-agent skill copies from the canonical `.agent-skills` tree.
 *
 * Usage:
 *   bun run skills:sync
 *
 * Copies are byte-identical to the canonical file so `skills:check` can compare
 * them directly. Only directories named `dora-*` are touched; locally installed
 * third-party skills in the same agent roots are left alone.
 */

import fs from 'fs'
import path from 'path'
import { logHeader, logKeyValue, logLevel } from './_shared'
import {
	CANONICAL_DIR,
	MANAGED_PREFIX,
	TARGETS,
	canonicalRoot,
	listCanonicalSkills,
	listManagedSkillsIn,
	listSkillFiles,
	readIfExists,
	repoRoot,
	unmanagedCanonicalSkills
} from './_shared/skills'

type SyncStats = {
	written: number
	unchanged: number
	pruned: number
}

function copySkill(skillName: string, targetDir: string, stats: SyncStats): void {
	const source = path.join(canonicalRoot(), skillName)
	const destination = path.join(repoRoot(), targetDir, skillName)

	for (const relative of listSkillFiles(source)) {
		const sourceFile = path.join(source, relative)
		const destinationFile = path.join(destination, relative)
		const next = fs.readFileSync(sourceFile)
		const current = readIfExists(destinationFile)

		if (current && current.equals(next)) {
			stats.unchanged++
			continue
		}

		fs.mkdirSync(path.dirname(destinationFile), { recursive: true })
		fs.writeFileSync(destinationFile, next)
		stats.written++
	}

	// Drop files that no longer exist in the canonical skill.
	const canonicalFiles = new Set(listSkillFiles(source))
	for (const relative of listSkillFiles(destination)) {
		if (canonicalFiles.has(relative)) continue
		fs.rmSync(path.join(destination, relative))
		stats.pruned++
	}
}

function pruneRemovedSkills(targetDir: string, canonical: string[], stats: SyncStats): void {
	const expected = new Set(canonical)

	for (const skillName of listManagedSkillsIn(targetDir)) {
		if (expected.has(skillName)) continue
		fs.rmSync(path.join(repoRoot(), targetDir, skillName), { recursive: true, force: true })
		stats.pruned++
		logLevel('warning', `Pruned removed skill ${targetDir}/${skillName}`)
	}
}

function main(): void {
	logHeader('Sync agent skills')

	const canonical = listCanonicalSkills()

	if (canonical.length === 0) {
		logLevel('warning', `No skills found in ${CANONICAL_DIR}/`)
		return
	}

	const unmanaged = unmanagedCanonicalSkills()
	if (unmanaged.length > 0) {
		for (const skillName of unmanaged) {
			logLevel(
				'error',
				`${CANONICAL_DIR}/${skillName} must be named ${MANAGED_PREFIX}* or its generated copies stay gitignored`
			)
		}
		process.exit(1)
	}

	const stats: SyncStats = { written: 0, unchanged: 0, pruned: 0 }

	for (const target of TARGETS) {
		fs.mkdirSync(path.join(repoRoot(), target.dir), { recursive: true })

		for (const skillName of canonical) {
			copySkill(skillName, target.dir, stats)
		}

		pruneRemovedSkills(target.dir, canonical, stats)
		logKeyValue(target.agent, `${canonical.length} skills -> ${target.dir}/`)
	}

	logKeyValue('Written', String(stats.written))
	logKeyValue('Unchanged', String(stats.unchanged))
	logKeyValue('Pruned', String(stats.pruned))
	logLevel('success', 'Agent skills are in sync')
}

main()
