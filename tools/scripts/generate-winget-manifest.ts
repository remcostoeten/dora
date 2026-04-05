import fs from 'fs'
import path from 'path'
import { logHeader, logKeyValue, logLevel } from './_shared'

type Config = {
	version: string
	tag: string
	installerUrl: string
	installerSha256: string
	installerFile: string
	outDir: string
	packageIdentifier: string
	publisher: string
	publisherUrl: string
	packageName: string
	shortDescription: string
	license: string
	licenseUrl: string
	manifestVersion: string
	installerType: string
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

function writeFile(outputPath: string, contents: string) {
	fs.mkdirSync(path.dirname(outputPath), { recursive: true })
	fs.writeFileSync(outputPath, contents)
	logLevel('success', `Wrote ${outputPath}`)
}

function readChecksumFromFile(checksumsPath: string, installerFile: string): string {
	const contents = fs.readFileSync(checksumsPath, 'utf8')
	const lines = contents
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)

	for (const line of lines) {
		const [hash, relativePath] = line.split(/\s{2,}/)
		if (!hash || !relativePath) {
			continue
		}

		if (relativePath === installerFile || relativePath.endsWith(`/${installerFile}`)) {
			return hash.toUpperCase()
		}
	}

	throw new Error(`Could not find ${installerFile} in ${checksumsPath}`)
}

function createVersionManifest(config: Config): string {
	return `# yaml-language-server: $schema=https://aka.ms/winget-manifest.version.${config.manifestVersion}.schema.json

PackageIdentifier: ${config.packageIdentifier}
PackageVersion: ${config.version}
DefaultLocale: en-US
ManifestType: version
ManifestVersion: ${config.manifestVersion}
`
}

function createLocaleManifest(config: Config): string {
	return `# yaml-language-server: $schema=https://aka.ms/winget-manifest.defaultLocale.${config.manifestVersion}.schema.json

PackageIdentifier: ${config.packageIdentifier}
PackageVersion: ${config.version}
PackageLocale: en-US
Publisher: ${config.publisher}
PublisherUrl: ${config.publisherUrl}
PublisherSupportUrl: ${config.publisherUrl}/issues
PackageName: ${config.packageName}
PackageUrl: ${config.publisherUrl}
License: ${config.license}
LicenseUrl: ${config.licenseUrl}
ShortDescription: ${config.shortDescription}
Tags:
- database
- postgres
- sqlite
- tauri
ReleaseNotesUrl: ${config.publisherUrl}/releases/tag/${config.tag}
ManifestType: defaultLocale
ManifestVersion: ${config.manifestVersion}
`
}

function createInstallerManifest(config: Config): string {
	return `# yaml-language-server: $schema=https://aka.ms/winget-manifest.installer.${config.manifestVersion}.schema.json

PackageIdentifier: ${config.packageIdentifier}
PackageVersion: ${config.version}
InstallerType: ${config.installerType}
Scope: user
UpgradeBehavior: install
Installers:
- Architecture: x64
  InstallerUrl: ${config.installerUrl}
  InstallerSha256: ${config.installerSha256}
ManifestType: installer
ManifestVersion: ${config.manifestVersion}
`
}

function main() {
	const version = requireFlag('version')
	const installerFile = getFlagValue('installer-file')
	const checksumsFile = getFlagValue('checksums-file')
	const explicitSha = getFlagValue('installer-sha256')

	if (!explicitSha && (!checksumsFile || !installerFile)) {
		throw new Error(
			'Provide --installer-sha256=... or both --checksums-file=... and --installer-file=...'
		)
	}

	const resolvedInstallerFile =
		installerFile ||
		decodeURIComponent(new URL(requireFlag('installer-url')).pathname.split('/').pop() || '')

	const config: Config = {
		version,
		tag: getFlagValue('tag') || `v${version}`,
		installerUrl: requireFlag('installer-url'),
		installerSha256: explicitSha
			? explicitSha.toUpperCase()
			: readChecksumFromFile(path.resolve(checksumsFile as string), resolvedInstallerFile),
		installerFile: resolvedInstallerFile,
		outDir: path.resolve(
			getFlagValue('out-dir') || path.join('packaging', 'winget', 'manifests', version)
		),
		packageIdentifier: getFlagValue('package-identifier') || 'RemcoStoeten.Dora',
		publisher: getFlagValue('publisher') || 'Remco Stoeten',
		publisherUrl: getFlagValue('publisher-url') || 'https://github.com/remcostoeten/dora',
		packageName: getFlagValue('package-name') || 'Dora',
		shortDescription:
			getFlagValue('short-description') ||
			'Dora is a desktop database studio for PostgreSQL, SQLite, and LibSQL.',
		license: getFlagValue('license') || 'GPL-3.0-only',
		licenseUrl:
			getFlagValue('license-url') ||
			'https://github.com/remcostoeten/dora/blob/master/LICENSE',
		manifestVersion: getFlagValue('manifest-version') || '1.9.0',
		installerType: getFlagValue('installer-type') || 'msi'
	}

	logHeader('Generating Winget Manifest')
	logKeyValue('Version', config.version)
	logKeyValue('Tag', config.tag)
	logKeyValue('Installer File', config.installerFile)
	logKeyValue('Installer URL', config.installerUrl)
	logKeyValue('Output', config.outDir)

	const baseName = config.packageIdentifier
	writeFile(path.join(config.outDir, `${baseName}.yaml`), createVersionManifest(config))
	writeFile(
		path.join(config.outDir, `${baseName}.locale.en-US.yaml`),
		createLocaleManifest(config)
	)
	writeFile(
		path.join(config.outDir, `${baseName}.installer.yaml`),
		createInstallerManifest(config)
	)
}

try {
	main()
} catch (error) {
	logLevel('error', error instanceof Error ? error.message : String(error))
	process.exit(1)
}
