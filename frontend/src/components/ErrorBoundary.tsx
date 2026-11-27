import { Component, type ReactNode } from 'react'

/** Keeps one broken page from blanking the whole site; shows the error instead. */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="text-center py-12 space-y-1">
        <p className="text-gray-700">This page couldn't be shown.</p>
        <p className="text-xs text-gray-500">{this.state.error.message}</p>
      </div>
    )
  }
}
