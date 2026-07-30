/**
 * Validates the project-local agent skills. Exits non-zero on any failure.
 *
 * Usage:
 *   bun run skills:check
 *
 * Three checks:
 *
 *   a) DRIFT — every generated copy under an agent root is byte-identical to
 *      its canonical `.agent-skills` source, with no stale managed skills left
 *      behind. Fix with `bun run skills:sync`.
 *
 *   b) PATHS — every repository path referenced by a SKILL.md exists. This is
 *      the check that matters: skills rot when a refactor moves a file and the
 *      skill keeps pointing at the old location. Only backtick-quoted spans are
 *      considered, matching how every tracked doc in this repo writes paths.
 *      Glob and placeholder segments (`apps/*​/src`, `<name>`) are reduced to
 *      their longest concrete prefix, which must exist.
 *
 *   c) COMMANDS — every project command referenced by a SKILL.md is defined in
 *      a package.json, turbo.json, or a workflow. Only lines inside fenced
 *      shell blocks are read, and only those starting with a project runner
 *      (bun, bunx, turbo, cargo, npm, npx, pnpm, yarn, node, docker); generic
 *      shell such as `git status` is ignored. A command matches when it equals
 *      a defined command or is one plus extra arguments.
 */

import fs from 'fs'
import path from 'path'
import { logHeader, logKeyValue, logLevel } from './_shared'
import {
	CANONICAL_DIR,
	MANAGED_PREFIX,
	SKILL_FILE,
	TARGETS,
	buildKnownCommands,
	canonicalRoot,
	extractCommandReferences,
	extractPathReferences,
	isKnownCommand,
	listCanonicalSkills,
	listManagedSkillsIn,
	listSkillFiles,
	readIfExists,
	repoRoot,
	unmanagedCanonicalSkills
} from './_shared/skills'

type Failure = {
	check: 'drift' | 'paths' | 'commands'
	skill: string
	detail: string
}

const failures: Failure[] = []

function fail(check: Failure['check'], skill: string, detail: string): void {
	failures.push({ check, skill, detail })
}

function checkDrift(canonical: string[]): void {
	for (const skillName of unmanagedCanonicalSkills()) {
		fail(
			'drift',
			skillName,
			`must be named ${MANAGED_PREFIX}* or its generated copies stay gitignored`
		)
	}

	for (const target of TARGETS) {
		for (const skillName of canonical) {
			const source = path.join(canonicalRoot(), skillName)
			const destination = path.join(repoRoot(), target.dir, skillName)

			for (const relative of listSkillFiles(source)) {
				const expected = fs.readFileSync(path.join(source, relative))
				const actual = readIfExists(path.join(destination, relative))

				if (actual === null) {
					fail('drift', skillName, `missing ${target.dir}/${skillName}/${relative}`)
					continue
				}

				if (!actual.equals(expected)) {
					fail(
						'drift',
						skillName,
						`${target.dir}/${skillName}/${relative} differs from canonical`
					)
				}
			}

			const canonicalFiles = new Set(listSkillFiles(source))
			for (const relative of listSkillFiles(destination)) {
				if (canonicalFiles.has(relative)) continue
				fail(
					'drift',
					skillName,
					`${target.dir}/${skillName}/${relative} is not in canonical`
				)
			}
		}

		const expected = new Set(canonical)
		for (const skillName of listManagedSkillsIn(target.dir)) {
			if (expected.has(skillName)) continue
			fail('drift', skillName, `${target.dir}/${skillName} has no canonical source`)
		}
	}
}

function checkPaths(skillName: string, markdown: string): void {
	for (const reference of extractPathReferences(markdown)) {
		if (fs.existsSync(path.join(repoRoot(), reference))) continue
		fail('paths', skillName, `referenced path does not exist: ${reference}`)
	}
}

function checkCommands(skillName: string, markdown: string, known: Set<string>): void {
	for (const command of extractCommandReferences(markdown)) {
		if (isKnownCommand(command, known)) continue
		fail(
			'commands',
			skillName,
			`command is not defined in package.json, turbo.json, or a workflow: ${command}`
		)
	}
}

function main(): void {
	logHeader('Check agent skills')

	const canonical = listCanonicalSkills()

	if (canonical.length === 0) {
		logLevel('warning', `No skills found in ${CANONICAL_DIR}/`)
		return
	}

	const known = buildKnownCommands()

	checkDrift(canonical)

	for (const skillName of canonical) {
		const markdown = fs.readFileSync(path.join(canonicalRoot(), skillName, SKILL_FILE), 'utf8')
		checkPaths(skillName, markdown)
		checkCommands(skillName, markdown, known)
	}

	logKeyValue('Skills', String(canonical.length))
	logKeyValue(
		'Targets',
		TARGETS.map(function (target) {
			return target.dir
		}).join(', ')
	)
	logKeyValue('Known commands', String(known.size))

	if (failures.length === 0) {
		logLevel(
			'success',
			'Skills are in sync, every referenced path exists, every command is defined'
		)
		return
	}

	for (const check of ['drift', 'paths', 'commands'] as const) {
		const group = failures.filter(function (failure) {
			return failure.check === check
		})
		if (group.length === 0) continue

		logHeader(`Failures: ${check}`)
		for (const failure of group) {
			logLevel('error', `${failure.skill}: ${failure.detail}`)
		}
	}

	if (
		failures.some(function (failure) {
			return failure.check === 'drift'
		})
	) {
		logLevel('info', 'Run `bun run skills:sync` to regenerate the agent copies')
	}

	process.exit(1)
}

main()
