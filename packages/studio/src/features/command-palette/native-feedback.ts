type FeedbackKind = 'selection' | 'impact' | 'success' | 'dismiss'

let audioContextRef: AudioContext | null = null

function canUseBrowserApis() {
	return typeof window !== 'undefined'
}

function getAudioContext() {
	if (!canUseBrowserApis()) return null

	const AudioContextCtor =
		window.AudioContext ||
		(
			window as typeof window & {
				webkitAudioContext?: typeof AudioContext
			}
		).webkitAudioContext

	if (!AudioContextCtor) return null
	if (!audioContextRef) {
		audioContextRef = new AudioContextCtor()
	}

	return audioContextRef
}

function vibrate(pattern: number | number[]) {
	if (!canUseBrowserApis() || typeof navigator === 'undefined' || !('vibrate' in navigator)) {
		return
	}

	try {
		navigator.vibrate(pattern)
	} catch {
		// silently fail
	}
}

async function playTone({
	frequency,
	duration,
	gain
}: {
	frequency: number
	duration: number
	gain: number
}) {
	const context = getAudioContext()
	if (!context) return

	try {
		if (context.state === 'suspended') {
			await context.resume()
		}

		const now = context.currentTime
		const oscillator = context.createOscillator()
		const envelope = context.createGain()

		oscillator.type = 'sine'
		oscillator.frequency.setValueAtTime(frequency, now)

		envelope.gain.setValueAtTime(0.0001, now)
		envelope.gain.exponentialRampToValueAtTime(gain, now + 0.01)
		envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)

		oscillator.connect(envelope)
		envelope.connect(context.destination)

		oscillator.start(now)
		oscillator.stop(now + duration + 0.02)
	} catch {
		// silently fail
	}
}

export function triggerNativeFeedback(kind: FeedbackKind = 'selection') {
	switch (kind) {
		case 'success':
			vibrate([10, 12, 16])
			void playTone({ frequency: 660, duration: 0.06, gain: 0.018 })
			break
		case 'impact':
			vibrate(14)
			void playTone({ frequency: 240, duration: 0.05, gain: 0.014 })
			break
		case 'dismiss':
			vibrate(8)
			void playTone({ frequency: 180, duration: 0.045, gain: 0.01 })
			break
		case 'selection':
		default:
			vibrate(6)
			void playTone({ frequency: 520, duration: 0.035, gain: 0.008 })
			break
	}
}
