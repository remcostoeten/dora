import { AlertCircle, RefreshCw, Wifi, Lock, Clock, Server, Database } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/shared/utils/cn'

type Props = {
	error: Error | null
	feature?: string
	onRetry?: () => void
	className?: string
}

type ErrorMapping = {
	icon: typeof AlertCircle
	title: string
	message: string
}

function mapError(error: Error | null): ErrorMapping {
	const msg = error?.message?.toLowerCase() || ''

	if (msg.includes('connection refused') || msg.includes('econnrefused')) {
		return {
			icon: Server,
			title: 'Connection Refused',
			message: 'Unable to connect to the database server. Make sure the server is running and accessible.'
		}
	}

	if (msg.includes('authentication') || msg.includes('password') || msg.includes('access denied')) {
		return {
			icon: Lock,
			title: 'Authentication Failed',
			message: 'Invalid credentials. Please check your username and password.'
		}
	}

	if (msg.includes('timeout') || msg.includes('timed out')) {
		return {
			icon: Clock,
			title: 'Connection Timed Out',
			message: 'The server took too long to respond. It may be overloaded or unreachable.'
		}
	}

	if (msg.includes('network') || msg.includes('fetch') || msg.includes('enotfound')) {
		return {
			icon: Wifi,
			title: 'Network Error',
			message: 'Unable to reach the server. Check your internet connection and try again.'
		}
	}

	if (msg.includes('does not exist') || msg.includes('unknown database') || msg.includes('no such table')) {
		return {
			icon: Database,
			title: 'Not Found',
			message: 'The requested database or table does not exist. Verify the name and try again.'
		}
	}

	if (msg.includes('ssl') || msg.includes('tls') || msg.includes('certificate')) {
		return {
			icon: Lock,
			title: 'SSL/TLS Error',
			message: 'Secure connection failed. Check your SSL settings or try disabling SSL.'
		}
	}

	if (msg.includes('permission') || msg.includes('denied') || msg.includes('privilege')) {
		return {
			icon: Lock,
			title: 'Permission Denied',
			message: 'You do not have permission to perform this action. Contact your database administrator.'
		}
	}

	return {
		icon: AlertCircle,
		title: 'Something Went Wrong',
		message: 'An unexpected error occurred. Please try again.'
	}
}

export function ErrorFallback({ error, feature, onRetry, className }: Props) {
	const mapping = mapError(error)
	const Icon = mapping.icon

	return (
		<div
			className={cn(
				'flex flex-col items-center justify-center h-full min-h-[300px] p-8 text-center',
				className
			)}
		>
			<div className='flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4'>
				<Icon className='h-7 w-7 text-destructive' />
			</div>

			<h3 className='text-lg font-semibold mb-2'>
				{feature ? `${feature}: ${mapping.title}` : mapping.title}
			</h3>

			<p className='text-muted-foreground mb-4 max-w-md'>
				{mapping.message}
			</p>

			{error && (
				<details className='mb-4 text-sm text-muted-foreground w-full max-w-md'>
					<summary className='cursor-pointer hover:text-foreground text-xs'>
						Technical details
					</summary>
					<pre className='mt-2 p-3 bg-muted rounded text-left overflow-auto text-xs whitespace-pre-wrap break-all'>
						{error.message}
					</pre>
				</details>
			)}

			{onRetry && (
				<Button onClick={onRetry} variant='outline' size='sm'>
					<RefreshCw className='h-4 w-4 mr-2' />
					Try Again
				</Button>
			)}
		</div>
	)
}

export { mapError }
