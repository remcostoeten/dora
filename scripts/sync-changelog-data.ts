import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

type ChangelogEntryType = 'feature' | 'fix' | 'refactor' | 'breaking'

type ChangelogGroup = {
	name: string
	items: string[]
}

type ParsedRelease = {
	version: string
	groups: ChangelogGroup[]
}

type ChangelogEntry = {
	version: string
	date: string
	commit: string
	title: string
	description: string
	type: ChangelogEntryType
	details?: string[]
}

type MarketingReleaseGroup = {
	name: string
	items: string[]
}

type MarketingRelease = {
	version: string
	date: string
	tagUrl: string
	groups: MarketingReleaseGroup[]
}

const REPO_ROOT = path.resolve(import.meta.dirname, '..')
const CHANGELOG_PATH = path.join(REPO_ROOT, 'CHANGELOG.md')
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'apps/desktop/package.json')
const DESKTOP_OUTPUT_PATH = path.join(
	REPO_ROOT,
	'packages/studio/src/features/sidebar/changelog-data.ts'
)
const MARKETING_OUTPUT_PATH = path.join(
	REPO_ROOT,
	'apps/marketing/src/core/content/changelog-data.ts'
)
const GITHUB_RELEASES_BASE = 'https://github.com/remcostoeten/dora/releases/tag'

function isVersionBump(text: string): boolean {
	const trimmed = text.trim()
	return /^v?\d+\.\d+/.test(trimmed) && trimmed.length <= 24
}

function parseChangelog(markdown: string): ParsedRelease[] {
	const releases: ParsedRelease[] = []
	let current: ParsedRelease | null = null
	let currentGroup: ChangelogGroup | null = null

	for (const line of markdown.split('\n')) {
		const versionMatch = line.match(/^## \[(v?.+?)\]/)
		if (versionMatch) {
			if (current) releases.push(current)
			current = {
				version: versionMatch[1].replace(/^v/, ''),
				groups: []
			}
			currentGroup = null
			continue
		}

		const groupMatch = line.match(/^### (.+)$/)
		if (groupMatch && current) {
			currentGroup = { name: groupMatch[1].trim(), items: [] }
			current.groups.push(currentGroup)
			continue
		}

		const itemMatch = line.match(/^[-*] (.+)$/)
		if (itemMatch && currentGroup) {
			const item = itemMatch[1].trim()
			if (item.length > 0) currentGroup.items.push(item)
		}
	}

	if (current) releases.push(current)
	return releases
}

const USER_FACING_GROUPS = [
	'Features',
	'Bug Fixes',
	'Refactoring',
	'Performance',
	'Documentation',
	'Other',
	'Styling',
	'Testing',
	'Build',
	'CI/CD',
	'Chores'
]

function collectMeaningfulItems(
	release: ParsedRelease,
	groups: string[] = USER_FACING_GROUPS
): string[] {
	const items: string[] = []

	for (const groupName of groups) {
		const group = release.groups.find(function (entry) {
			return entry.name === groupName
		})
		if (!group) continue

		for (const item of group.items) {
			if (!isVersionBump(item)) items.push(item)
		}
	}

	return items
}

function inferType(release: ParsedRelease): ChangelogEntryType {
	for (const group of release.groups) {
		if (group.name.toLowerCase().includes('breaking') && group.items.length > 0) {
			return 'breaking'
		}
	}

	const byGroupName: Record<string, ChangelogEntryType> = {
		Features: 'feature',
		'Bug Fixes': 'fix',
		Refactoring: 'refactor'
	}

	for (const groupName of ['Features', 'Bug Fixes', 'Refactoring']) {
		const group = release.groups.find(function (entry) {
			return entry.name === groupName
		})
		if (group && group.items.some(function (item) { return !isVersionBump(item) })) {
			return byGroupName[groupName]
		}
	}

	return 'feature'
}

function sentenceCase(text: string): string {
	if (text.length === 0) return text
	return text.charAt(0).toUpperCase() + text.slice(1)
}

function buildTitle(release: ParsedRelease): string {
	const priorityGroups = ['Features', 'Bug Fixes', 'Refactoring', 'Performance', 'Documentation']

	for (const groupName of priorityGroups) {
		const group = release.groups.find(function (entry) {
			return entry.name === groupName
		})
		const item = group?.items.find(function (entry) {
			return !isVersionBump(entry)
		})
		if (item) return sentenceCase(item)
	}

	const fallback = collectMeaningfulItems(release)[0]
	if (fallback) return sentenceCase(fallback)
	return `Release v${release.version}`
}

function buildDescription(release: ParsedRelease, title: string): string {
	const items = collectMeaningfulItems(release, [
		'Features',
		'Bug Fixes',
		'Refactoring',
		'Performance',
		'Documentation',
		'Other'
	])
	if (items.length === 0) return `Updates in v${release.version}.`

	const normalizedTitle = title.toLowerCase()
	const uniqueItems = items.filter(function (item, index) {
		return (
			items.findIndex(function (candidate) {
				return candidate.toLowerCase() === item.toLowerCase()
			}) === index
		)
	})
	const summaryItems = uniqueItems.filter(function (item) {
		return sentenceCase(item).toLowerCase() !== normalizedTitle
	})

	if (summaryItems.length === 0) return sentenceCase(uniqueItems[0])
	if (summaryItems.length === 1) {
		return `${sentenceCase(uniqueItems[0])}. ${sentenceCase(summaryItems[0])}.`
	}

	return `${sentenceCase(uniqueItems[0])}. ${sentenceCase(summaryItems[1])}.`
}

function getTagDate(version: string): string {
	const tag = `v${version}`
	try {
		const output = execSync(`git log -1 --format=%as "${tag}"`, {
			cwd: REPO_ROOT,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		}).trim()
		if (output) return output
	} catch {
		// Fall back below when the tag is missing locally.
	}

	try {
		const output = execSync(`git log -1 --format=%as "refs/tags/${tag}"`, {
			cwd: REPO_ROOT,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		}).trim()
		if (output) return output
	} catch {
		// Ignore and use today's date.
	}

	return new Date().toISOString().split('T')[0]
}

function toEntry(release: ParsedRelease): ChangelogEntry {
	const title = buildTitle(release)
	const details = collectMeaningfulItems(release)

	return {
		version: release.version,
		date: getTagDate(release.version),
		commit: `v${release.version}`,
		title,
		description: buildDescription(release, title),
		type: inferType(release),
		...(details.length > 0 ? { details } : {})
	}
}

function serializeEntry(entry: ChangelogEntry, indent: string): string {
	const lines = [
		`${indent}{`,
		`${indent}\tversion: ${JSON.stringify(entry.version)},`,
		`${indent}\tdate: ${JSON.stringify(entry.date)},`,
		`${indent}\tcommit: ${JSON.stringify(entry.commit)},`,
		`${indent}\ttitle: ${JSON.stringify(entry.title)},`,
		`${indent}\tdescription: ${JSON.stringify(entry.description)},`,
		`${indent}\ttype: ${JSON.stringify(entry.type)}`
	]

	if (entry.details && entry.details.length > 0) {
		lines[lines.length - 1] = `${lines[lines.length - 1]},`
		lines.push(`${indent}\tdetails: [`)
		for (const detail of entry.details) {
			lines.push(`${indent}\t\t${JSON.stringify(detail)},`)
		}
		lines.push(`${indent}\t]`)
	}

	lines.push(`${indent}}`)
	return lines.join('\n')
}

function toMarketingRelease(release: ParsedRelease): MarketingRelease {
	const groups = release.groups
		.map(function (group) {
			return {
				name: group.name,
				items: group.items.filter(function (item) {
					return !isVersionBump(item)
				})
			}
		})
		.filter(function (group) {
			return group.items.length > 0
		})

	return {
		version: release.version,
		date: getTagDate(release.version),
		tagUrl: `${GITHUB_RELEASES_BASE}/v${release.version}`,
		groups
	}
}

function serializeMarketingRelease(release: MarketingRelease, indent: string): string {
	const groupBlocks = release.groups
		.map(function (group) {
			const items = group.items
				.map(function (item) {
					return `${indent}\t\t\t${JSON.stringify(item)},`
				})
				.join('\n')

			return `${indent}\t\t{
${indent}\t\t\tname: ${JSON.stringify(group.name)},
${indent}\t\t\titems: [
${items}
${indent}\t\t\t]
${indent}\t\t}`
		})
		.join(`,\n`)

	return `${indent}{
${indent}\tversion: ${JSON.stringify(release.version)},
${indent}\tdate: ${JSON.stringify(release.date)},
${indent}\ttagUrl: ${JSON.stringify(release.tagUrl)},
${indent}\tgroups: [
${groupBlocks}
${indent}\t]
${indent}}`
}

function generateMarketingChangelogData(
	currentVersion: string,
	releases: MarketingRelease[]
): string {
	const serializedReleases = releases
		.map(function (release) {
			return serializeMarketingRelease(release, '\t')
		})
		.join(',\n')

	return `// Generated by scripts/sync-changelog-data.ts — do not edit manually.
// Regenerate with: bun run generate:changelog-data

export type ChangelogReleaseGroup = {
\tname: string
\titems: string[]
}

export type ChangelogRelease = {
\tversion: string
\tdate: string
\ttagUrl: string
\tgroups: ChangelogReleaseGroup[]
}

export const CURRENT_VERSION = ${JSON.stringify(currentVersion)}

export const CHANGELOG_RELEASES: ChangelogRelease[] = [
${serializedReleases}
]
`
}

function generateChangelogData(currentVersion: string, entries: ChangelogEntry[]): string {
	const serializedEntries = entries
		.map(function (entry) {
			return serializeEntry(entry, '\t')
		})
		.join(',\n')

	return `// Generated by scripts/sync-changelog-data.ts — do not edit manually.
// Regenerate with: bun run generate:changelog-data

export type ChangelogEntry = {
\tversion: string
\tdate: string
\tcommit: string
\ttitle: string
\tdescription: string
\ttype: 'feature' | 'fix' | 'refactor' | 'breaking'
\tdetails?: string[]
}

export const CURRENT_VERSION = ${JSON.stringify(currentVersion)}

export const CHANGELOG: ChangelogEntry[] = [
${serializedEntries}
]
`
}

function main(): void {
	const markdown = fs.readFileSync(CHANGELOG_PATH, 'utf8')
	const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')) as {
		version: string
	}
	const releases = parseChangelog(markdown)
	const entries = releases.map(toEntry)
	const marketingReleases = releases.map(toMarketingRelease)
	const desktopOutput = generateChangelogData(packageJson.version, entries)
	const marketingOutput = generateMarketingChangelogData(
		packageJson.version,
		marketingReleases
	)

	fs.mkdirSync(path.dirname(MARKETING_OUTPUT_PATH), { recursive: true })
	fs.writeFileSync(DESKTOP_OUTPUT_PATH, desktopOutput)
	fs.writeFileSync(MARKETING_OUTPUT_PATH, marketingOutput)
	console.log(
		`Synced ${entries.length} changelog entries to ${path.relative(REPO_ROOT, DESKTOP_OUTPUT_PATH)} (v${packageJson.version}).`
	)
	console.log(
		`Synced ${marketingReleases.length} changelog releases to ${path.relative(REPO_ROOT, MARKETING_OUTPUT_PATH)}.`
	)
}

main()
