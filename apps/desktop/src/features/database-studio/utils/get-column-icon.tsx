import { Hash, Type, Calendar, ToggleLeft, Braces, Fingerprint, FileText, List, Clock } from "lucide-react";

export function getColumnIcon(type: string) {
	const normalizeType = type.toLowerCase()

	if (
		normalizeType.includes('int') ||
		normalizeType.includes('serial') ||
		normalizeType.includes('numeric') ||
		normalizeType.includes('decimal') ||
		normalizeType.includes('double') ||
		normalizeType.includes('real')
	) {
		return Hash
	}

	if (
		normalizeType.includes('char') ||
		normalizeType.includes('text') ||
		normalizeType.includes('string')
	) {
		return Type
	}

	if (normalizeType.includes('bool')) {
		return ToggleLeft
	}

	if (normalizeType.includes('timestamp') || normalizeType.includes('date')) {
		return Calendar
	}

	if (normalizeType.includes('time')) {
		return Clock
	}

	if (normalizeType.includes('json') || normalizeType.includes('jsonb')) {
		return Braces
	}

	if (normalizeType.includes('array')) {
		return List
	}

	if (normalizeType.includes('uuid')) {
		return Fingerprint
	}

	return FileText
}
