import { useRegisterSW } from 'virtual:pwa-register/react'
export function PwaStatus() {
  const { needRefresh: [refresh, setRefresh], updateServiceWorker } = useRegisterSW()
  if (!refresh) return null
  return <aside className="fb-pwa-status" role="status"><span>A new FindBox update is ready.</span><button onClick={() => void updateServiceWorker(true)}>Update</button><button onClick={() => setRefresh(false)}>Later</button></aside>
}
