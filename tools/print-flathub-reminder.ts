if (process.env.DORA_SKIP_FLATHUB_REMINDER === '1') {
	process.exit(0)
}

const doc = 'docs/distribution/release-guide.md#flathub-submission-checklist'
const message = `Flathub submission checklist: ${doc}`

console.error(`\x1b[2m\x1b[36m${message}\x1b[0m`)
