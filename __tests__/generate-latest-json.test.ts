import { describe, expect, it } from 'vitest'
import {
	assertPlatformsPresent,
	buildManifest,
	collectPlatforms,
	parseRequiredPlatforms,
	platformsFor,
	REQUIRED_PLATFORMS
} from '../tools/scripts/generate-latest-json'

const LINUX = '/assets/release-linux-assets/appimage/Dora_0.38.0_amd64.AppImage'
const WINDOWS = '/assets/release-windows-assets/nsis/Dora_0.38.0_x64-setup.exe'
const MACOS = '/assets/release-macos-assets/macos/Dora.app.tar.gz'
const LINUX_ARM = '/assets/release-linux-aarch64-assets/appimage/Dora_0.38.0_aarch64.AppImage'
const WINDOWS_ARM = '/assets/release-windows-arm64-assets/nsis/Dora_0.38.0_arm64-setup.exe'

function sigsFor(artifacts: string[]): string[] {
	return artifacts.flatMap((artifact) => [artifact, `${artifact}.sig`])
}

function fakeSignature(path: string): string {
	return `signature-for:${path.split('/').pop()}\n`
}

describe('generate-latest-json platform mapping', function () {
	it('maps updater artifacts to platform keys', function () {
		expect(platformsFor(LINUX)).toEqual(['linux-x86_64'])
		expect(platformsFor(WINDOWS)).toEqual(['windows-x86_64'])
		expect(platformsFor(MACOS)).toEqual(['darwin-aarch64', 'darwin-x86_64'])
		expect(platformsFor(LINUX_ARM)).toEqual(['linux-aarch64'])
		expect(platformsFor(WINDOWS_ARM)).toEqual(['windows-aarch64'])
	})

	it('ignores installer-only artifacts', function () {
		expect(platformsFor('/assets/Dora_0.38.0_universal.dmg')).toEqual([])
		expect(platformsFor('/assets/Dora_0.38.0_amd64.deb')).toEqual([])
		expect(platformsFor('/assets/Dora-0.38.0-1.x86_64.rpm')).toEqual([])
	})

	it('builds one entry per platform with a tag-scoped download url', function () {
		const platforms = collectPlatforms(sigsFor([LINUX, WINDOWS, MACOS]), {
			repo: 'remcostoeten/dora',
			tag: 'v0.38.0',
			readSignature: fakeSignature
		})

		expect(Object.keys(platforms).sort()).toEqual([
			'darwin-aarch64',
			'darwin-x86_64',
			'linux-x86_64',
			'windows-x86_64'
		])
		const universal = {
			signature: 'signature-for:Dora.app.tar.gz.sig',
			url: 'https://github.com/remcostoeten/dora/releases/download/v0.38.0/Dora.app.tar.gz'
		}
		expect(platforms['darwin-aarch64']).toEqual(universal)
		expect(platforms['darwin-x86_64']).toEqual(universal)
	})

	it('adds the arm64 platforms when their builds are present', function () {
		const platforms = collectPlatforms(
			sigsFor([LINUX, WINDOWS, MACOS, LINUX_ARM, WINDOWS_ARM]),
			{
				repo: 'remcostoeten/dora',
				tag: 'v0.38.0',
				readSignature: fakeSignature
			}
		)

		expect(platforms['linux-aarch64']?.url).toMatch(/Dora_0\.38\.0_aarch64\.AppImage$/)
		expect(platforms['windows-aarch64']?.url).toMatch(/Dora_0\.38\.0_arm64-setup\.exe$/)
		expect(platforms['linux-x86_64']?.url).toMatch(/_amd64\.AppImage$/)
	})
})

describe('generate-latest-json missing-platform guard', function () {
	it('accepts a manifest that covers every required platform', function () {
		const manifest = buildManifest({
			files: sigsFor([LINUX, WINDOWS, MACOS]),
			rawVersion: 'v0.38.0',
			repo: 'remcostoeten/dora',
			notes: 'release notes',
			readSignature: fakeSignature,
			now: new Date('2026-07-27T00:00:00.000Z')
		})

		expect(manifest.version).toBe('0.38.0')
		expect(Object.keys(manifest.platforms)).toHaveLength(4)
	})

	it('fails when the macOS updater artifacts are missing (#223)', function () {
		expect(() =>
			buildManifest({
				files: sigsFor([LINUX, WINDOWS]),
				rawVersion: 'v0.38.0',
				repo: 'remcostoeten/dora',
				notes: '',
				readSignature: fakeSignature
			})
		).toThrow(/missing updater platforms: darwin-aarch64, darwin-x86_64/)
	})

	it('does not treat a .dmg as macOS updater coverage', function () {
		const dmg = '/assets/release-macos-assets/dmg/Dora_0.38.0_universal.dmg'
		expect(() =>
			buildManifest({
				files: [...sigsFor([LINUX, WINDOWS]), dmg],
				rawVersion: 'v0.38.0',
				repo: 'remcostoeten/dora',
				notes: '',
				readSignature: fakeSignature
			})
		).toThrow(/darwin-aarch64/)
	})

	it('lists every missing platform when nothing is signed', function () {
		expect(() => assertPlatformsPresent({})).toThrow(
			/linux-x86_64, windows-x86_64, darwin-aarch64, darwin-x86_64/
		)
	})

	it('reports which platforms were found alongside the missing ones', function () {
		expect(() =>
			assertPlatformsPresent({ 'linux-x86_64': { signature: 'sig', url: 'https://example' } })
		).toThrow(/Found: linux-x86_64/)
	})

	it('parses the require-platforms override', function () {
		expect(parseRequiredPlatforms('')).toEqual(REQUIRED_PLATFORMS)
		expect(parseRequiredPlatforms('none')).toEqual([])
		expect(parseRequiredPlatforms('linux-x86_64, darwin-aarch64')).toEqual([
			'linux-x86_64',
			'darwin-aarch64'
		])
	})
})
