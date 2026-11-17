import { describe, expect, it } from 'vitest'
import { nixRelease, scoopManifest } from '../tools/scripts/generate-package-manifests'

const X64 = {
	url: 'https://github.com/remcostoeten/dora/releases/download/v0.45.0/Dora_0.45.0_x64-setup.exe',
	sha256: 'aa'
}
const ARM64 = {
	url: 'https://github.com/remcostoeten/dora/releases/download/v0.45.0/Dora_0.45.0_arm64-setup.exe',
	sha256: 'bb'
}

describe('scoop manifest', function () {
	it('unpacks the NSIS installer with 7-Zip for every shipped architecture', function () {
		const manifest = scoopManifest('0.45.0', { '64bit': X64, arm64: ARM64 })

		expect(manifest.architecture).toEqual({
			'64bit': { url: `${X64.url}#/dl.7z`, hash: 'aa' },
			arm64: { url: `${ARM64.url}#/dl.7z`, hash: 'bb' }
		})
		expect(manifest.shortcuts).toEqual([['dora.exe', 'Dora']])
	})

	it('quotes $PLUGINSDIR so PowerShell does not expand it to the install dir', function () {
		const manifest = scoopManifest('0.45.0', { '64bit': X64 })

		expect(manifest.post_install[0]).toContain("(Join-Path $dir '$PLUGINSDIR')")
	})

	it('only lists autoupdate URLs for the architectures it ships', function () {
		const manifest = scoopManifest('0.45.0', { '64bit': X64 })

		expect(Object.keys(manifest.autoupdate.architecture)).toEqual(['64bit'])
		expect(manifest.autoupdate.architecture['64bit'].url).toBe(
			'https://github.com/remcostoeten/dora/releases/download/v$version/Dora_$version_x64-setup.exe#/dl.7z'
		)
	})
})

describe('nix release', function () {
	it('keys the .deb assets by Nix system', function () {
		const deb = { url: 'https://example.invalid/Dora_0.45.0_amd64.deb', sha256: 'cc' }

		expect(nixRelease('0.45.0', 'v0.45.0', { 'x86_64-linux': deb })).toEqual({
			version: '0.45.0',
			tag: 'v0.45.0',
			systems: { 'x86_64-linux': deb }
		})
	})
})
