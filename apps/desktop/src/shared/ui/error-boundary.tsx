import { Component, ErrorInfo, ReactNode } from 'react'
import { ErrorFallback } from './error-fallback'

type Props = {
	children: ReactNode
	fallback?: ReactNode
	onReset?: () => void
	feature?: string
}

type State = {
	hasError: boolean
	error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error('[ErrorBoundary] Caught error:', error)
		console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
	}

	handleReset = () => {
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
