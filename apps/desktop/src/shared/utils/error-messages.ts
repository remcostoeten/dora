/**
 * Maps technical database/connection errors to user-friendly messages
 */
export function mapConnectionError(error: Error | string): string {
	const msg = (typeof error === 'string' ? error : error.message).toLowerCase()

	if (msg.includes('connection refused') || msg.includes('econnrefused')) {
		return 'Connection refused. Make sure the database server is running and accessible.'
	}

	if (msg.includes('authentication') || msg.includes('password') || msg.includes('access denied')) {
		return 'Authentication failed. Please check your username and password.'
	}

	if (msg.includes('timeout') || msg.includes('timed out')) {
		return 'Connection timed out. The server may be overloaded or unreachable.'
	}

	if (msg.includes('network') || msg.includes('fetch') || msg.includes('enotfound')) {
		return 'Network error. Check your internet connection and try again.'
	}

	if (msg.includes('does not exist') || msg.includes('unknown database')) {
		return 'Database not found. Please verify the database name.'
	}

	if (msg.includes('no such table') || msg.includes('table not found')) {
		return 'Table not found. It may have been deleted or renamed.'
	}

	if (msg.includes('ssl') || msg.includes('tls') || msg.includes('certificate')) {
		return 'SSL/TLS connection failed. Check your SSL settings or try disabling SSL.'
	}

	if (msg.includes('permission') || msg.includes('denied') || msg.includes('privilege')) {
		return 'Permission denied. You may not have access to perform this action.'
	}

	if (msg.includes('host')) {
		return 'Could not resolve host. Please check the hostname or IP address.'
	}

	if (msg.includes('port')) {
		return 'Connection failed on the specified port. Verify the port number is correct.'
	}

	if (msg.includes('syntax') || msg.includes('parse error')) {
		return 'SQL syntax error. Please check your query.'
	}

	if (msg.includes('duplicate') || msg.includes('unique constraint')) {
		return 'Duplicate entry. A record with this value already exists.'
	}

	if (msg.includes('foreign key') || msg.includes('constraint')) {
		return 'Constraint violation. This action would violate database integrity rules.'
	}

	// Return original message if no mapping found
	const originalMsg = typeof error === 'string' ? error : error.message
	return originalMsg || 'An unexpected error occurred. Please try again.'
}

/**
 * Maps query execution errors to user-friendly messages
 */
export function mapQueryError(error: Error | string): string {
	const msg = (typeof error === 'string' ? error : error.message).toLowerCase()

	if (msg.includes('syntax')) {
		return 'SQL syntax error. Check your query for typos or missing keywords.'
	}

	if (msg.includes('no such column') || msg.includes('unknown column')) {
		return 'Column not found. The specified column does not exist in this table.'
	}

	if (msg.includes('no such table') || msg.includes('table') && msg.includes('not exist')) {
		return 'Table not found. The specified table does not exist.'
	}

	if (msg.includes('ambiguous')) {
		return 'Ambiguous column reference. Specify the table name for this column.'
	}

	if (msg.includes('division by zero')) {
		return 'Division by zero error in your query.'
	}

	if (msg.includes('data type') || msg.includes('type mismatch')) {
		return 'Data type mismatch. The value does not match the expected column type.'
	}

	return mapConnectionError(error)
}
