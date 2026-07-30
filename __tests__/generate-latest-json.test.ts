import { describe, expect, it } from 'vitest'
import {
	assertPlatformsPresent,
	buildManifest,
	collectPlatforms,
	parseRequiredPlatforms,
	platformFor,
	REQUIRED_PLATFORMS
} from '../tools/scripts/generate-latest-json'

const LINUX = '/assets/release-linux-assets/appimage/Dora_0.38.0_amd64.AppImage'
const WINDOWS = '/assets/release-windows-assets/nsis/Dora_0.38.0_x64-setup.exe'
const MACOS = '/assets/release-macos-assets/macos/Dora.app.tar.gz'

function sigsFor(artifacts: string[]): string[] {
	return artifacts.flatMap((artifact) => [artifact, `${artifact}.sig`])
}

function fakeSignature(path: string): string {
	return `signature-for:${path.split('/').pop()}\n`
}

describe('generate-latest-json platform mapping', function () {
	it('maps updater artifacts to platform keys', function () {
		expect(platformFor(LINUX)).toBe('linux-x86_64')
		expect(platformFor(WINDOWS)).toBe('windows-x86_64')
		expect(platformFor(MACOS)).toBe('darwin-aarch64')
	})

	it('ignores installer-only artifacts', function () {
		expect(platformFor('/assets/Dora_0.38.0_aarch64.dmg')).toBeNull()
		expect(platformFor('/assets/Dora_0.38.0_amd64.deb')).toBeNull()
		expect(platformFor('/assets/Dora-0.38.0-1.x86_64.rpm')).toBeNull()
	})

	it('builds one entry per platform with a tag-scoped download url', function () {
		const platforms = collectPlatforms(sigsFor([LINUX, WINDOWS, MACOS]), {
			repo: 'remcostoeten/dora',
			tag: 'v0.38.0',
			readSignature: fakeSignature
		})

		expect(Object.keys(platforms).sort()).toEqual([
			'darwin-aarch64',
			'linux-x86_64',
			'windows-x86_64'
		])
		expect(platforms['darwin-aarch64']).toEqual({
			signature: 'signature-for:Dora.app.tar.gz.sig',
			url: 'https://github.com/remcostoeten/dora/releases/download/v0.38.0/Dora.app.tar.gz'
		})
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
		expect(Object.keys(manifest.platforms)).toHaveLength(3)
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
		).toThrow(/missing updater platforms: darwin-aarch64/)
	})

	it('does not treat a .dmg as macOS updater coverage', function () {
		const dmg = '/assets/release-macos-assets/dmg/Dora_0.38.0_aarch64.dmg'
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
			/linux-x86_64, windows-x86_64, darwin-aarch64/
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
