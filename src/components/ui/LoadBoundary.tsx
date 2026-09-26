import { Component, type ReactNode } from 'react'
export class LoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div className="fb-load-failure" role="alert"><h2>Let’s reconnect.</h2><p>This part of FindBox could not load. Connect to the internet and try again. Your saved belongings are still on this device.</p><button onClick={() => window.location.reload()}>Try again</button><p><a href="/app/sign-in">Back to sign in</a></p></div>
    return this.props.children
  }
}
