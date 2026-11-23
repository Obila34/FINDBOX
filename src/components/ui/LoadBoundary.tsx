import { Component, type ReactNode } from 'react'
import { isStaleBuildError, reloadForNewRelease } from '@/lib/staleBuild'
export class LoadBoundary extends Component<{ children: ReactNode }, { failed: boolean; updating: boolean }> {
  state = { failed: false, updating: false }
  static getDerivedStateFromError(error: unknown) {
    // A page from before the latest update: reload once into the new one instead of showing an error.
    return { failed: true, updating: isStaleBuildError(error) && reloadForNewRelease() }
  }
  render() {
    if (this.state.updating) return <div className="fb-scene-load" role="status">Updating FindBox…</div>
    if (this.state.failed) return <div className="fb-load-failure" role="alert"><h2>Let’s reconnect.</h2><p>This part of FindBox could not load. Connect to the internet and try again. Your saved belongings are still on this device.</p><button onClick={() => window.location.reload()}>Try again</button><p><a href="/app/sign-in">Back to sign in</a></p></div>
    return this.props.children
  }
}
