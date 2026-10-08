import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import {
  ArrowDown, ArrowRight, ArrowUpRight, Bookmark, Check, CheckCheck, Code2, Compass, Copy,
  Expand, GitBranch, Globe2, Layers3, Loader2, Orbit, Play, Plug, Puzzle, Send, Sparkles,
  Square, Star, Terminal, X, BookOpen, PenTool,
} from 'lucide-react'
import Markdown from 'react-markdown'
import { relativeTime, shortNumber } from './api'
import type { Capability, Job, Kind, Message, Runtime, Scout } from './types'

export const kindIcons = { Skills: Layers3, Connectors: Plug, Plugins: Puzzle, Harnesses: Terminal }
export function Mark({ small = false }: { small?: boolean }) {
  return <span className={'brand-mark' + (small ? ' small' : '')}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m8 24 8-16 8 16M12 19h8" /></svg></span>
}
export function StatusDot({ ready = false, busy = false }: { ready?: boolean; busy?: boolean }) {
  return <span className={'status-dot' + (ready ? ' ready' : '') + (busy ? ' busy' : '')} />
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = ref.current
    node?.showModal()
    return () => { node?.close() }
  }, [])
  return <dialog ref={ref} className={'modal' + (wide ? ' wide' : '')} aria-label={title}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === ref.current) onClose() }}>
    <div className="modal-shell">
      <div className="modal-bar"><span>{title}</span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>
      {children}
    </div>
  </dialog>
}

export function CodeBlock({ text, label = 'Example prompt', onCopy }: { text: string; label?: string; onCopy: (text: string) => void }) {
  const [copied, setCopied] = useState(false)
  return <div className="code-block"><div><span>{label}</span><button aria-label={'Copy ' + label} onClick={() => {
    onCopy(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800)
  }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button></div><pre>{text}</pre></div>
}

export function Constellation({ onSelect, active }: { onSelect: (kind: Kind) => void; active: boolean }) {
  const [hovered, setHovered] = useState<Kind | null>(null)
  const nodes: { kind: Kind; x: number; y: number; className: string }[] = [
    { kind: 'Skills', x: 27, y: 25, className: 'peach' },
    { kind: 'Connectors', x: 76, y: 29, className: 'mint' },
    { kind: 'Plugins', x: 29, y: 78, className: 'lavender' },
    { kind: 'Harnesses', x: 80, y: 74, className: 'sand' },
  ]
  return <div className={'constellation' + (active ? ' scanning' : '')}>
    <svg className="constellation-lines" viewBox="0 0 400 300" fill="none" aria-hidden="true">
      <defs><radialGradient id="core-glow"><stop stopColor="#f0a273" stopOpacity=".14" /><stop offset="1" stopColor="#f0a273" stopOpacity="0" /></radialGradient></defs>
      <circle cx="207" cy="152" r="112" fill="url(#core-glow)" />
      <ellipse cx="207" cy="152" rx="154" ry="85" transform="rotate(-31 207 152)" stroke="currentColor" strokeOpacity=".17" />
      <ellipse cx="207" cy="152" rx="150" ry="82" transform="rotate(33 207 152)" stroke="currentColor" strokeOpacity=".17" />
      <circle cx="207" cy="152" r="57" stroke="currentColor" strokeOpacity=".13" strokeDasharray="2 7" />
      <path d="M207 152 108 75M207 152 304 87M207 152 116 234M207 152 320 222" stroke="currentColor" strokeOpacity=".2" strokeDasharray="4 5" />
      <g className="signal-orbit"><circle cx="207" cy="152" r="112" stroke="#f0a273" strokeOpacity=".12" /><circle cx="319" cy="152" r="3" fill="#f0a273" /></g>
      <circle cx="74" cy="160" r="2" fill="#a79de6" /><circle cx="240" cy="46" r="2" fill="#81b6ad" /><circle cx="182" cy="269" r="2" fill="#f0a273" />
    </svg>
    <div className="constellation-core"><Mark /><span>arnyx</span></div>
    {nodes.map(({ kind, x, y, className }) => {
      const Icon = kindIcons[kind]
      return <button key={kind} className={'constellation-node ' + className} style={{ left: x + '%', top: y + '%' }}
        aria-label={'Discover ' + kind.toLowerCase()} onClick={() => onSelect(kind)}
        onMouseEnter={() => setHovered(kind)} onMouseLeave={() => setHovered(null)}
        onFocus={() => setHovered(kind)} onBlur={() => setHovered(null)}>
        <span><Icon size={18} /></span><small>{kind}</small>
      </button>
    })}
    <span className="constellation-caption">{hovered ? 'Explore ' + hovered.toLowerCase() : active ? 'Listening for new capabilities' : 'A more capable ecosystem'}</span>
  </div>
}

export function CapabilityArt({ item }: { item: Capability }) {
  const Icon = item.icon === 'design' ? PenTool : item.icon === 'code' ? Code2 : item.icon === 'docs' ? BookOpen
    : item.icon === 'git' ? GitBranch : item.icon === 'browser' ? Globe2 : kindIcons[item.kind]
  return <div className={'capability-art ' + item.accent}>
    <div className="art-grain" />
    <svg viewBox="0 0 300 132" fill="none" aria-hidden="true" className={'art-geometry art-' + item.icon}>
      {item.kind === 'Connectors' ? <>
        {[42, 63, 84].map(r => <circle key={r} cx="150" cy="65" r={r} stroke="currentColor" strokeOpacity=".14" />)}
        <path d="M150 65 60 32M150 65 234 32M150 65 70 106M150 65 242 105" stroke="currentColor" strokeOpacity=".3" strokeDasharray="3 5" />
        {[['60','32'],['234','32'],['70','106'],['242','105']].map(([cx,cy]) => <circle key={cx} cx={cx} cy={cy} r="5" fill="currentColor" fillOpacity=".35" />)}
      </> : item.icon === 'design' ? <>
        <path d="m150 5 88 55-88 61-88-61Z" stroke="currentColor" strokeOpacity=".4" />
        <path d="m150 21 65 39-65 45-65-45Zm0 18 37 21-37 25-37-25Z" stroke="currentColor" strokeOpacity=".24" />
        <path d="M150 5v116M62 60h176" stroke="currentColor" strokeOpacity=".18" />
      </> : item.kind === 'Harnesses' ? <>
        {[0,1,2,3,4].map(i => <path key={i} d={'M' + (70+i*13) + ' ' + (100-i*14) + 'h' + (160-i*26) + 'v' + (i*28-68)} stroke="currentColor" strokeOpacity=".2" />)}
        <path d="m114 44 22 21-22 21M153 86h28" stroke="currentColor" strokeOpacity=".55" strokeWidth="2" />
      </> : <>
        {[0,1,2].map(i => <rect key={i} x={67+i*27} y={14+i*14} width="110" height="72" rx="5" transform="rotate(-12 150 65)" stroke="currentColor" strokeOpacity={.15+i*.1} />)}
        <path d="m123 52-13 12 13 12m48-24 13 12-13 12" stroke="currentColor" strokeOpacity=".4" />
      </>}
    </svg>
    <span className="art-category">{item.kind.slice(0, -1)}</span>
    <span className="art-icon"><Icon size={25} strokeWidth={1.6} /></span>
    {item.featured && <span className="art-feature"><Sparkles size={11} />Editor's pick</span>}
  </div>
}

export function CapabilityCard({ item, saved, installed, onOpen, onSave, compared, onCompare }: {
  item: Capability; saved: boolean; installed: boolean; onOpen: () => void; onSave: () => void; compared: boolean; onCompare: () => void
}) {
  return <motion.article className={'capability-card' + (compared ? ' compared' : '')} layout="position" transition={{ duration: .22 }}>
    <div className="card-art-wrap"><CapabilityArt item={item} /><button className={'bookmark-button' + (saved ? ' saved' : '')}
      onClick={onSave} aria-label={(saved ? 'Remove ' : 'Save ') + item.name + (saved ? ' from stack' : ' to stack')}
      aria-pressed={saved}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button></div>
    <div className="card-content">
      <div className="card-owner">{item.owner}{installed && <span><CheckCheck size={12} />Installed</span>}</div>
      <button className="card-title" onClick={onOpen}>{item.name}<ArrowUpRight size={16} /></button>
      <p>{item.description}</p>
      <div className="card-tags">{item.tags.slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}</div>
      <div className="card-bottom">
        <span title={item.stars != null ? 'GitHub repository stars, not skill installs' : 'Source metadata has not been checked'}>{item.stars != null ? <><Star size={12} />{shortNumber(item.stars)}</> : <><Compass size={12} />Curated</>}</span>
        <button className={'compare-toggle' + (compared ? ' active' : '')} aria-pressed={compared} onClick={onCompare}>{compared ? <Check size={12} /> : <Layers3 size={12} />}{compared ? 'Selected' : 'Compare'}</button>
        <button className="explore-button" onClick={onOpen} aria-label={'Explore ' + item.name}><ArrowRight size={17} /></button>
      </div>
    </div>
  </motion.article>
}

export function ScoutRow({ source, compact = false }: { source: Scout; compact?: boolean }) {
  const Icon = kindIcons[source.kind]
  return <div className={'scout-row' + (compact ? ' compact' : '')}>
    <span className={'scout-icon ' + source.kind.toLowerCase()}><Icon size={16} /></span>
    <div><strong>{source.name}</strong><small>{compact ? relativeTime(source.lastRun) : source.subtitle}</small></div>
    <span className={'scout-state ' + source.status}>{source.status === 'running' ? <Loader2 className="spin" size={12} /> : <StatusDot ready={source.status === 'complete'} />}
      {source.status === 'complete' ? compact ? source.found + ' found' : 'Checked' : source.status === 'partial' ? 'Partial' : source.status === 'error' ? 'Unavailable' : source.status === 'running' ? 'Scanning' : 'Ready'}</span>
  </div>
}

export function Coordinator({ runtime, messages, job, onSend, onCancel, onExpand, roomy = false, onClear }: {
  runtime: Runtime | null; messages: Message[]; job: Job | null; onSend: (message: string) => Promise<void>
  onCancel: () => void; onExpand?: () => void; roomy?: boolean; onClear?: () => void
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  const running = job?.status === 'running'
  const ready = runtime?.available && runtime?.authenticated
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }) }, [messages.length, job?.answer])
  async function submit(text = draft) {
    if (!text.trim() || running || sending) return
    setSending(true)
    try { await onSend(text.trim()); setDraft('') } finally { setSending(false) }
  }
  return <section className={'coordinator' + (roomy ? ' roomy' : '')} aria-label="Arnyx coordinator">
    <header><span className="coordinator-symbol"><Orbit size={19} /></span><div><strong>Your coordinator</strong><small><StatusDot ready={!!ready} />{runtime ? ready ? 'Codex CLI ready' : 'CLI needs attention' : 'Checking Codex CLI'}</small></div>
      {onExpand && <button className="icon-button" onClick={onExpand} aria-label="Expand coordinator"><Expand size={15} /></button>}
      {onClear && <button className="subtle-button" onClick={onClear} disabled={running}>Clear chat</button>}
    </header>
    <div className="chat-scroll">
      {!messages.length && <div className="coordinator-welcome"><span className="welcome-orbit"><Orbit size={31} strokeWidth={1.2} /></span>
        <h3>A clearer path<br />to your next build.</h3><p>Ask about a discovery, find the right tools, or make sense of your stack.</p>
        <div className="chat-suggestions">
          {['What should I try first?', 'Build me a frontend stack', 'What are my scouts finding?'].map(text => <button key={text} onClick={() => submit(text)} disabled={running || sending}>{text}<ArrowUpRight size={13} /></button>)}
        </div>
      </div>}
      {messages.map(message => <div key={message.id} className={'chat-message ' + message.role}>
        <small>{message.role === 'user' ? 'You' : 'Arnyx'}</small><Markdown>{message.content}</Markdown>
      </div>)}
      {(running || sending) && <div className="chat-thinking"><span className="thinking-dots"><i /><i /><i /></span><span>{job?.progress || 'Starting Codex'}</span></div>}
      {job?.status === 'error' && <div className="inline-error">{job.error}</div>}
      {job?.status === 'cancelled' && <p className="muted chat-stopped">Response stopped. You can ask another question.</p>}
      <div ref={bottom} />
    </div>
    <form className="chat-compose" onSubmit={event => { event.preventDefault(); void submit() }}>
      <textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ask Arnyx anything…"
        maxLength={4000} rows={2} aria-label="Message to coordinator" onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit() }
        }} />
      <div><span><Terminal size={12} />Powered by your Codex CLI</span>{running ? <button type="button" onClick={onCancel} aria-label="Stop response"><Square size={13} fill="currentColor" /></button>
        : <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message"><ArrowRight size={17} /></button>}</div>
    </form>
    <footer>Uses your catalog, stack, and source activity.</footer>
  </section>
}
