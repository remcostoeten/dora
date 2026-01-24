import { useRecording } from './recording-provider'

export function RecordingOverlay() {
	const { isRecordingMode } = useRecording()

	if (!isRecordingMode) return null

	return (
		<div className='fixed top-2 right-2 z-[9999] flex items-center gap-2 px-2 py-1 rounded-md bg-red-500/90 text-white text-xs font-medium pointer-events-none'>
			<span className='w-2 h-2 rounded-full bg-white animate-pulse' />
			REC
		</div>
	)
}
