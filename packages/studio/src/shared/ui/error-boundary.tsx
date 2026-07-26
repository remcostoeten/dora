import { Component, ErrorInfo, ReactNode } from 'react'
import { ErrorFallback } from './error-fallback'

function resetKeysChanged(prev: unknown[] | undefined, next: unknown[] | undefined): boolean {
	if (prev === next) return false
	if (!prev || !next) return true
	return prev.length !== next.length || prev.some((key, index) => !Object.is(key, next[index]))
}

type Props = {
	children: ReactNode
	fallback?: ReactNode
	onReset?: () => void
	feature?: string
	resetKeys?: unknown[]
}

type State = {
	hasError: boolean
	error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false, error: null }
		this.handleReset = this.handleReset.bind(this)
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error('[ErrorBoundary] Caught error:', error)
		console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
	}

	componentDidUpdate(prevProps: Props) {
		if (!this.state.hasError) return
		if (resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
			this.setState({ hasError: false, error: null })
		}
	}

	handleReset() {
		this.setState({ hasError: false, error: null })
		this.props.onReset?.()
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback
			}
			return (
				<ErrorFallback
					error={this.state.error}
					feature={this.props.feature}
					onRetry={this.handleReset}
				/>
			)
		}
		return this.props.children
	}
}
