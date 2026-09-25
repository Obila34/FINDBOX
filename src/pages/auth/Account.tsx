import { useNavigate } from 'react-router-dom'
import { LogOut, Smartphone, ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tile } from '@/components/ui/Tile'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { usePerson, useStore } from '@/store/useStore'
import { ROLE_LABEL } from '@/domain/labels'
export function Account() {
 const person = usePerson()!; const state = useStore(); const nav = useNavigate(); const kids = state.people.filter(p => person.childIds?.includes(p.id))
 return <div className="mx-auto max-w-2xl"><PageHeader title="Your account" lede="Your people. Your preferences. Your FindBox." compact /><Tile className="flex items-center gap-4"><Avatar person={person} size={64} /><div><h2 className="text-xl font-semibold">{person.name}</h2><p>{ROLE_LABEL[person.role]} · {state.school.name}</p></div></Tile>{kids.length > 0 && <Tile className="mt-4"><h2 className="font-semibold">Your family</h2>{kids.map(k => <div key={k.id} className="mt-4 flex items-center gap-3"><Avatar person={k} size={38} /><span>{k.name}<small className="block text-ink-3">{k.classLabel}</small></span></div>)}</Tile>}<Tile className="mt-4"><div className="flex items-center gap-3"><Smartphone size={20} /><div><h2 className="font-medium">This device</h2><p className="text-sm text-ink-3">Your current account, belongings, and activity are saved in this browser.</p></div></div></Tile><div className="mt-5 flex flex-wrap gap-3"><Button variant="secondary" icon={<LogOut size={17} />} onClick={() => { state.signOut(); nav('/app/sign-in') }}>Sign out</Button><Button variant="ghost" iconRight={<ArrowRight size={17} />} onClick={() => { state.signOut(); nav('/app/sign-in') }}>Switch account</Button></div></div>
}
