import { z } from 'zod'

const baseConnectionSchema = z.object({
	name: z.string().min(1, 'Connection name is required').max(100, 'Name is too long'),
})

export const sqliteConnectionSchema = baseConnectionSchema.extend({
	type: z.literal('sqlite'),
	url: z.string().min(1, 'Database file path is required'),
})

export const libsqlConnectionSchema = baseConnectionSchema.extend({
	type: z.literal('libsql'),
	url: z
		.string()
		.min(1, 'Database URL is required')
		.refine(
			(val) => val.startsWith('libsql://') || val.startsWith('https://') || val.startsWith('http://'),
			'URL must start with libsql://, https://, or http://'
		),
	authToken: z.string().optional(),
})

export const connectionStringSchema = baseConnectionSchema.extend({
	type: z.enum(['postgres', 'mysql']),
	url: z
		.string()
		.min(1, 'Connection string is required')
		.refine(
			(val) =>
				val.startsWith('postgres://') ||
				val.startsWith('postgresql://') ||
				val.startsWith('mysql://'),
			'Invalid connection string format'
		),
})

export const connectionFieldsSchema = baseConnectionSchema.extend({
	type: z.enum(['postgres', 'mysql']),
	host: z.string().min(1, 'Host is required'),
	port: z.number().int().min(1, 'Port must be positive').max(65535, 'Port must be less than 65536'),
	user: z.string().min(1, 'Username is required'),
	password: z.string().optional(),
	database: z.string().min(1, 'Database name is required'),
	ssl: z.boolean().optional(),
})

export const sshTunnelSchema = z.object({
	enabled: z.literal(true),
	host: z.string().min(1, 'SSH host is required'),
	port: z.number().int().min(1).max(65535).default(22),
	username: z.string().min(1, 'SSH username is required'),
	authMethod: z.enum(['password', 'keyfile']),
	password: z.string().optional(),
	privateKeyPath: z.string().optional(),
}).refine(
	(data) => {
		if (data.authMethod === 'password') {
			return !!data.password
		}
		if (data.authMethod === 'keyfile') {
			return !!data.privateKeyPath
		}
		return true
	},
	{
		message: 'Password or private key is required based on auth method',
		path: ['password'],
	}
)

export type ValidationResult = {
	success: boolean
	error?: string
	field?: string
}

// Validate connection based on type and mode
export function validateConnection(
	formData: Record<string, unknown>,
	useConnectionString: boolean
): ValidationResult {
	try {
		const type = formData.type as string

		// Validate name first
		if (!formData.name || (formData.name as string).trim() === '') {
			return { success: false, error: 'Connection name is required', field: 'name' }
		}

		if (type === 'sqlite') {
			sqliteConnectionSchema.parse(formData)
		} else if (type === 'libsql') {
			libsqlConnectionSchema.parse(formData)
		} else if (type === 'postgres' || type === 'mysql') {
			if (useConnectionString) {
				connectionStringSchema.parse(formData)
			} else {
				connectionFieldsSchema.parse(formData)
			}
		}

		return { success: true }
	} catch (error) {
		if (error instanceof z.ZodError) {
			const firstError = error.issues[0]
			return {
				success: false,
				error: firstError.message,
				field: firstError.path[0] as string,
			}
		}
		return { success: false, error: 'Validation failed' }
	}
}

// Get field-specific error if any
export function getFieldError(
	formData: Record<string, unknown>,
	field: string,
	useConnectionString: boolean
): string | undefined {
	const result = validateConnection(formData, useConnectionString)
	if (!result.success && result.field === field) {
		return result.error
	}
	return undefined
}
