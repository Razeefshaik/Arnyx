import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight, ArrowUpRight, Bell, BookOpen, Check, CheckCheck, ChevronDown, ChevronRight,
  CircleHelp, Command, Compass, Download, ExternalLink, FolderOpen, GitBranch, History,
  Layers3, Loader2, Menu, Moon, Orbit, Plus, Radio, RefreshCw, Search, Settings2, ShieldCheck,
  SlidersHorizontal, Sparkles, Star, Sun, Terminal, Trash2, X,
} from 'lucide-react'
import { api, relativeTime, shortNumber } from './api'
import {
  CapabilityArt, CapabilityCard, CodeBlock, Constellation, Coordinator, kindIcons, Mark, Modal, ScoutRow, StatusDot,
} from './components'
import type { AppState, Capability, Job, Kind, Review, Runtime, View } from './types'

const navigation: { name: View; icon: typeof Compass }[] = [
  { name: 'Discover', icon: Compass }, { name: 'My stack', icon: Layers3 },
  { name: 'Crawlers', icon: Radio }, { name: 'Walkthroughs', icon: BookOpen },
  { name: 'Activity', icon: History },
]
const kinds: ('All' | Kind)[] = ['All', 'Skills', 'Connectors', 'Plugins', 'Harnesses']
const categories = ['All categories', 'Design', 'Development', 'Testing', 'Agent workflows', 'Productivity']
const descriptions: Record<View, string> = {
  Discover: 'Find the capabilities that move your work forward.',
  'My stack': 'Your chosen tools, ready for the next thing you build.',
  Crawlers: 'Keep a pulse on the AI ecosystem.',
  Walkthroughs: 'Understand the workflow before you add the tool.',
  Activity: 'A clear record of what is happening in your workspace.',
  Settings: 'Your workspace. Your tools. Your preferences.',
}

export function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [runtime, setRuntime] = useState<Runtime | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('Discover')
  const [kind, setKind] = useState<'All' | Kind>('All')
  const [category, setCategory] = useState('All categories')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recommended')
  const [limit, setLimit] = useState(9)
  const [selected, setSelected] = useState<Capability | null>(null)
  const [detailTab, setDetailTab] = useState('Overview')
  const [review, setReview] = useState<Review | null>(null)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [installBusy, setInstallBusy] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [job, setJob] = useState<Job | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [comparison, setComparison] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [scanning, setScanning] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('arnyx-theme') || 'dark')
  const [activityFilter, setActivityFilter] = useState('All')
  const searchRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<number>(0)

  const notify = useCallback((message: string) => {
    window.clearTimeout(toastTimer.current); setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(''), 5000)
  }, [])
  const refresh = useCallback(async () => {
    try {
      const fresh = await api<AppState>('/state')
      setState(fresh); setError('')
      if (fresh.activeJob.id) setJob(fresh.activeJob as Job)
    } catch (e) { setError((e as Error).message) }
  }, [])
  const refreshRuntime = useCallback(async (force = false) => {
    try { setRuntime(await api<Runtime>(force ? '/runtime/refresh' : '/runtime', force ? {} : undefined)) }
    catch (e) { notify((e as Error).message) }
  }, [notify])

  useEffect(() => {
    void refresh(); void refreshRuntime()
    const interval = window.setInterval(() => { void refresh() }, 5000)
    return () => window.clearInterval(interval)
  }, [refresh, refreshRuntime])
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('arnyx-theme', theme) }, [theme])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(value => !value) }
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) { event.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => {
    if (!job || job.status !== 'running') return
    const poll = window.setInterval(async () => {
      try {
        const result = await api<Job>('/coordinator/' + job.id)
        setJob(result)
        if (result.status !== 'running') void refresh()
      } catch (e) { setJob({ ...job, status: 'error', error: (e as Error).message }) }
    }, 1200)
    return () => window.clearInterval(poll)
  }, [job?.id, job?.status, refresh])
  useEffect(() => { setLimit(9) }, [query, kind, category, sort, view])

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); notify('Copied to clipboard') }
    catch { notify('Clipboard unavailable. Select and copy the text manually.') }
  }
  async function scan() {
    setScanning(true)
    try {
      const result = await api<{ started: boolean }>('/crawl', {})
      notify(result.started ? 'Four scouts are checking their sources' : 'Discovery is already running')
      await refresh()
    } catch (e) { notify((e as Error).message) } finally { setScanning(false) }
  }
  async function save(item: Capability) {
    if (!state) return
    const saved = !state.saved.includes(item.id)
    try {
      const result = await api<{ saved: string[] }>('/saved', { id: item.id, saved })
      setState(old => old && { ...old, saved: result.saved })
      notify(saved ? item.name + ' saved to your stack' : item.name + ' removed from your stack')
    } catch (e) { notify((e as Error).message) }
  }
  function open(item: Capability, tab = 'Overview') {
    setSelected(item); setDetailTab(tab); setReview(null); setReviewError('')
  }
  function isInstalled(item: Capability) {
    return !!runtime?.installedSkills.some(skill => [item.id, item.skillName, item.path?.split('/').at(-1)].includes(skill.name))
  }
  async function getReview() {
    if (!selected) return
    setReviewBusy(true); setReviewError('')
    try { setReview(await api<Review>('/capabilities/' + encodeURIComponent(selected.id) + '/review')) }
    catch (e) { setReviewError((e as Error).message) } finally { setReviewBusy(false) }
  }
  async function install() {
    if (!selected || !review) return
    setInstallBusy(true); setReviewError('')
    try {
      await api('/capabilities/' + encodeURIComponent(selected.id) + '/install', { reviewId: review.reviewId })
      notify(selected.name + ' installed. Available to Codex on your next turn.')
      setReview(null); setDetailTab('Setup'); await refreshRuntime(true); await refresh()
    } catch (e) { setReviewError((e as Error).message) } finally { setInstallBusy(false) }
  }
  async function send(message: string) {
    try {
      const response = await api<Job>('/coordinator', { message })
      setJob(response); await refresh()
    } catch (e) { notify((e as Error).message) }
  }
  async function cancel() {
    if (!job) return
    try { await api('/coordinator/' + job.id + '/cancel', {}); setJob({ ...job, status: 'cancelled' }); await refresh() }
    catch (e) { notify((e as Error).message) }
  }
  async function settings(scheduled: boolean, intervalMinutes: number) {
    try {
      await api('/settings', { scheduled, intervalMinutes }); await refresh()
      notify(scheduled ? 'Scheduled discovery is enabled while Arnyx is running' : 'Scheduled discovery paused')
    } catch (e) { notify((e as Error).message) }
  }
  async function clearChat() {
    try { await api('/messages', undefined, 'DELETE'); setJob(null); await refresh() }
    catch (e) { notify((e as Error).message) }
  }
  function toggleCompare(id: string) {
    setComparison(old => old.includes(id) ? old.filter(value => value !== id) : old.length < 3 ? [...old, id] : old)
    if (comparison.length >= 3 && !comparison.includes(id)) notify('Compare up to three capabilities at a time')
  }
  const visible = useMemo(() => {
    let items = state?.catalog || []
    if (view === 'My stack') items = items.filter(item => state?.saved.includes(item.id))
    if (kind !== 'All') items = items.filter(item => item.kind === kind)
    if (category !== 'All categories') items = items.filter(item => item.category === category)
    if (query) {
      const needle = query.toLowerCase()
      items = items.filter(item => [item.name, item.description, item.owner, ...item.tags].join(' ').toLowerCase().includes(needle))
    }
    return [...items].sort((a, b) => sort === 'newest'
      ? Date.parse(b.updatedAt || '1970-01-01') - Date.parse(a.updatedAt || '1970-01-01')
      : sort === 'stars' ? (b.stars || 0) - (a.stars || 0)
      : Number(!!b.featured) - Number(!!a.featured) || b.score.total - a.score.total || a.name.localeCompare(b.name))
  }, [state, kind, category, query, sort, view])
  const checked = state?.catalog.filter(item => item.observedAt).length || 0
  const ready = !!runtime?.available && !!runtime?.authenticated
  const compared = state?.catalog.filter(item => comparison.includes(item.id)) || []

  return <div className="app">
    <aside className="sidebar">
      <button className="brand" onClick={() => setView('Discover')} aria-label="Arnyx home"><Mark /><span>arnyx<span className="brand-period">.</span></span></button>
      <div className="workspace-selector"><span className="workspace-avatar">R</span><div><strong>Personal workspace</strong><small>Your AI, amplified</small></div><ChevronDown size={13} /></div>
      <nav aria-label="Main navigation">{navigation.map(({ name, icon: Icon }) => <button key={name} className={view === name ? 'active' : ''} onClick={() => { setView(name); setQuery('') }}>
        <Icon size={18} /><span>{name}</span>{name === 'My stack' && !!state?.saved.length && <small>{state.saved.length}</small>}{name === 'Crawlers' && state?.crawling && <StatusDot busy />}
      </button>)}</nav>
      <div className="sidebar-note"><div><span className="note-spark"><Sparkles size={16} /></span><strong>Small additions.<br />Bigger possibilities.</strong></div><p>Your next useful skill might already be out there.</p><button onClick={() => { setView('Discover'); void scan() }}>Find something new<ArrowUpRight size={14} /></button></div>
      <div className="sidebar-bottom"><button className={view === 'Settings' ? 'active' : ''} onClick={() => setView('Settings')}><Settings2 size={18} /><span>Settings</span></button>
        <button onClick={() => { setView('Walkthroughs'); setQuery('') }}><CircleHelp size={18} /><span>Getting started</span></button>
        <div className="sidebar-runtime"><span className="runtime-terminal"><Terminal size={16} /></span><div><strong>Codex CLI</strong><small><StatusDot ready={ready} />{runtime ? ready ? 'Connected locally' : 'Setup needed' : 'Checking connection'}</small></div><button className="icon-button" aria-label="Open CLI settings" onClick={() => setView('Settings')}><ArrowUpRight size={14} /></button></div>
        <div className="user-profile"><span className="user-avatar">R</span><div><strong>Razeef</strong><small>Personal account</small></div><button className="icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button></div>
      </div>
    </aside>

    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">Workspace<ChevronRight size={13} /><span>{view}</span></div>
        <label className="global-search"><Search size={16} /><input ref={searchRef} value={query} onChange={event => { setQuery(event.target.value); if (!['Discover', 'My stack', 'Walkthroughs'].includes(view)) setView('Discover') }} placeholder="Search your next capability…" aria-label="Search capabilities" /><button onClick={() => setCommandOpen(true)} aria-label="Open command menu"><Command size={11} />K</button></label>
        <button className="icon-button mobile-menu" aria-label="Open workspace menu" onClick={() => setCommandOpen(true)}><Menu size={18} /></button>
        <button className="topbar-activity icon-button" aria-label="View recent activity" onClick={() => setView('Activity')}><Bell size={18} />{!!state?.events.length && <i />}</button>
      </header>
      <div className="page-layout">
        <main className="main-content" id="main-content">
          <div className="page-heading"><div><h1>{view}</h1><p>{descriptions[view]}</p></div>
            {view !== 'Settings' && <button className="button secondary scan-button" onClick={() => void scan()} disabled={scanning || state?.crawling}><RefreshCw size={14} className={state?.crawling ? 'spin' : ''} />{state?.crawling ? 'Discovering' : 'Run discovery'}</button>}
          </div>
          {error && <div className="connection-error"><Radio size={20} /><div><strong>Backend connection needs attention</strong><p>{error}</p></div><button className="button secondary" onClick={() => void refresh()}>Retry</button></div>}
          {!state && !error && <div className="loading-state"><Loader2 className="spin" />Connecting to your workspace…</div>}

          {state && view === 'Discover' && <>
            <section className="discovery-hero"><div className="hero-copy"><span className="hero-label"><span className="tiny-spark">✳</span>Your capability radar</span><h2>Make room for<br />your next big idea.</h2><p>Discover the skills, connections, and workflows<br className="desktop-break" /> that make your AI work better for you.</p><button className="button primary" onClick={() => document.querySelector('#capability-catalog')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })}>Explore capabilities<ArrowRight size={16} /></button></div>
              <Constellation active={state.crawling} onSelect={value => { setKind(value); document.querySelector('#capability-catalog')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }} />
              <div className="hero-footnote"><span><StatusDot ready={checked > 0} busy={state.crawling} />{state.crawling ? 'Your scouts are exploring' : checked > 0 ? checked + ' capabilities checked at source' : 'A curated starting point for your stack'}</span><span>Powered by curiosity. Built around you.</span></div>
            </section>
          </>}

          {state && (view === 'Discover' || view === 'My stack') && <section id="capability-catalog" className="catalog-section">
            <div className="catalog-title"><div><h2>{view === 'My stack' ? 'Your collection' : 'Discover your next advantage'}<span>{visible.length}</span></h2><p>{view === 'My stack' ? 'Saved capabilities stay here. Installation is a separate step.' : 'Useful tools. Clear walkthroughs. A better place to start.'}</p></div></div>
            <div className="kind-tabs" role="group" aria-label="Capability type">{kinds.map(value => { const Icon = value === 'All' ? Compass : kindIcons[value]; return <button key={value} className={kind === value ? 'active' : ''} aria-pressed={kind === value} onClick={() => setKind(value)}><Icon size={14} />{value === 'All' ? 'All capabilities' : value}</button> })}</div>
            <div className="catalog-controls"><label><SlidersHorizontal size={13} /><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Category filter">{categories.map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={12} /></label><span>{query ? 'Results for “' + query + '”' : kind === 'All' ? 'A little of everything' : kind + ' for your workflow'}</span>
              <label className="sort-control"><span>Sort by:</span><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort capabilities"><option value="recommended">Recommended</option><option value="newest">Source freshness</option><option value="stars">Repository stars</option></select><ChevronDown size={12} /></label></div>
            {visible.length ? <div className="capability-grid">{visible.slice(0, limit).map(item => <CapabilityCard key={item.id} item={item} saved={state.saved.includes(item.id)} installed={isInstalled(item)} onOpen={() => open(item)} onSave={() => void save(item)} compared={comparison.includes(item.id)} onCompare={() => toggleCompare(item.id)} />)}</div>
              : <div className="empty-state"><Layers3 size={36} strokeWidth={1} /><h3>{view === 'My stack' && !query ? 'A stack worth making your own.' : 'Nothing here just yet.'}</h3><p>{view === 'My stack' ? 'Save a capability with the bookmark button. You can understand and install it whenever you’re ready.' : 'Try a broader search or a different filter.'}</p><button className="button primary" onClick={() => { setQuery(''); setCategory('All categories'); setKind('All'); setView('Discover') }}>{view === 'My stack' ? 'Discover capabilities' : 'Reset filters'}<ArrowRight size={15} /></button></div>}
            {visible.length > limit && <button className="load-more" onClick={() => setLimit(value => value + 12)}>Explore more capabilities<Plus size={14} /><span>{visible.length - limit} more</span></button>}
            {view === 'My stack' && <div className="installed-section"><div className="section-title"><h2>Already in your Codex</h2><span>{runtime?.installedSkills.length || 0} skills detected</span></div><div className="installed-chips">{runtime?.installedSkills.map((skill, index) => <span key={skill.scope + skill.name + index}><CheckCheck size={13} />{skill.name}<small>{skill.scope}</small></span>)}</div><p className="muted">Detected in project and user skill folders. Saved tools and installed skills are tracked separately.</p></div>}
          </section>}

          {state && view === 'Crawlers' && <div className="crawlers-view">
            <section className="scout-summary"><span className="large-orbit"><Radio size={30} strokeWidth={1.3} /></span><div><h2>Four scouts. One shared horizon.</h2><p>Independent workers check trusted skill repositories, the official MCP registry, plugin sources, and harness releases.</p></div><span className="scout-count">{state.sources.filter(source => source.status === 'complete').length}<small>of 4 checked</small></span></section>
            <div className="scout-grid">{state.sources.map(source => <article key={source.id} className="scout-card"><ScoutRow source={source} /><p>{source.id === 'skills' ? 'Reads skill instructions from Anthropic, Vercel, and OpenAI repositories.' : source.id === 'connectors' ? 'Finds active MCP listings for practical developer and productivity tools.' : source.id === 'plugins' ? 'Watches published plugin repositories and host compatibility.' : 'Tracks Codex, LangGraph, and AutoGen metadata and published releases.'}</p><dl><div><dt>Last checked</dt><dd>{relativeTime(source.lastRun)}</dd></div><div><dt>Capabilities found</dt><dd>{source.found}</dd></div></dl>{source.error && <div className="inline-error">{source.error}</div>}<a href={source.url} target="_blank" rel="noreferrer">View source<ArrowUpRight size={14} /></a></article>)}</div>
            <section className="schedule-card"><div><h3>Keep discovering</h3><p>Refresh your sources automatically while Arnyx is running.</p></div><label className="switch"><input type="checkbox" checked={state.settings.scheduled} onChange={event => void settings(event.target.checked, state.settings.intervalMinutes)} aria-label="Enable scheduled discovery" /><span /></label>
              <label className="interval-label">Check every<select value={state.settings.intervalMinutes} onChange={event => void settings(state.settings.scheduled, Number(event.target.value))} aria-label="Discovery interval"><option value="15">15 minutes</option><option value="60">1 hour</option><option value="360">6 hours</option><option value="1440">1 day</option></select></label></section>
            <div className="quiet-note"><ShieldCheck size={17} /><p>Scouts read public metadata. Discovery never installs a tool, runs its scripts, or connects an account.</p></div>
          </div>}

          {state && view === 'Walkthroughs' && <div className="walkthroughs-view">
            <section className="walkthrough-banner"><BookOpen size={32} strokeWidth={1.2} /><div><h2>From “looks useful” to “I get it.”</h2><p>See the advantages, follow the setup, and try a concrete example.</p></div></section>
            <div className="walkthrough-list">{visible.slice(0, limit).map(item => { const Icon = kindIcons[item.kind]; return <button key={item.id} onClick={() => open(item, 'Walkthrough')}><span className={'walkthrough-icon ' + item.accent}><Icon size={22} /></span><div><strong>{item.name}</strong><p>{item.description}</p></div><span className="walkthrough-step-count">{item.guide.steps.length} steps</span><ArrowRight size={18} /></button> })}</div>
            {visible.length > limit && <button className="load-more" onClick={() => setLimit(value => value + 12)}>More walkthroughs<Plus size={14} /></button>}
            {!visible.length && <div className="empty-state"><Search size={30} /><h3>No matching walkthroughs</h3><button className="button secondary" onClick={() => setQuery('')}>Clear search</button></div>}
          </div>}

          {state && view === 'Activity' && <div className="activity-view"><div className="activity-filters">{['All', 'Discovery', 'Stack', 'Coordinator'].map(value => <button className={activityFilter === value ? 'active' : ''} key={value} onClick={() => setActivityFilter(value)}>{value}</button>)}</div>
            {state.events.filter(event => activityFilter === 'All' || event.type === ({ Discovery: 'crawl', Stack: 'stack', Coordinator: 'coordinator' } as Record<string, string>)[activityFilter]).map(event => <article className="activity-event" key={event.id}><span className={'event-icon ' + event.type}>{event.type === 'crawl' ? <Radio size={16} /> : event.type === 'stack' ? <Layers3 size={16} /> : event.type === 'coordinator' ? <Orbit size={16} /> : event.type === 'install' ? <Download size={16} /> : <History size={16} />}</span><div><strong>{event.message}</strong><small>{new Date(event.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</small></div><span>{relativeTime(event.at)}</span></article>)}
            {!state.events.length && <div className="empty-state"><History size={36} strokeWidth={1} /><h3>Your workspace story starts here.</h3><p>Run discovery, save a tool, or ask the coordinator. Real actions will appear here.</p><button className="button primary" onClick={() => void scan()}>Run your first discovery<ArrowRight size={15} /></button></div>}
          </div>}

          {state && view === 'Settings' && <div className="settings-view">
            <section className="settings-section"><div className="section-title"><h2>Your intelligence engine</h2><button className="subtle-button" onClick={() => void refreshRuntime(true)}><RefreshCw size={13} />Recheck</button></div><div className="engine-status"><span className="engine-icon"><Terminal size={28} /></span><div><h3>Codex CLI</h3><p>{runtime?.version || 'Checking CLI version'}</p></div><span className={'status-pill' + (ready ? ' ready' : '')}><StatusDot ready={ready} />{ready ? 'Ready' : 'Needs setup'}</span></div><p>{runtime?.message}</p><div className="settings-facts"><div><small>LLM provider</small><strong>Your configured Codex CLI</strong></div><div><small>Coordinator permissions</small><strong>Read-only sandbox</strong></div><div><small>Data storage</small><strong>Local H2 database</strong></div><div><small>Backend</small><strong>Spring Boot 4.1.1 · Java 21+</strong></div></div><CodeBlock text="codex login" label="CLI sign-in" onCopy={text => void copy(text)} /></section>
            <section className="settings-section"><h2>Connected MCP tools</h2><p>Detected from your CLI configuration. Enabled does not mean a live connection was tested.</p>{runtime?.connections.map(connection => <div className="connection-row" key={connection.name}><PlugIcon /><strong>{connection.name}</strong><span>{connection.enabled ? 'Enabled' : 'Disabled'} · {connection.authStatus}</span></div>)}{!runtime?.connections.length && <p className="muted">{runtime?.connectionsUnavailable ? 'Could not inspect MCP configuration. Check codex mcp list in your terminal.' : 'No MCP servers configured in this CLI.'}</p>}</section>
            <section className="settings-section"><h2>Appearance</h2><div className="appearance-options">{['dark', 'light'].map(value => <button key={value} className={theme === value ? 'selected' : ''} aria-pressed={theme === value} onClick={() => setTheme(value)}>{value === 'dark' ? <Moon size={18} /> : <Sun size={18} />}<span>{value === 'dark' ? 'Observatory dark' : 'Daylight'}</span>{theme === value && <Check size={15} />}</button>)}</div></section>
            <section className="settings-section"><h2>Built around your control</h2><p>Arnyx runs on your computer. Public source requests go directly to GitHub and the MCP Registry. Coordinator questions use your Codex CLI account and provider.</p><p>Connector authentication happens with the provider. Provider-specific plugins are marked for manual adaptation. No third-party tool is silently installed.</p><a className="text-link" href="https://learn.chatgpt.com/docs/non-interactive-mode" target="_blank" rel="noreferrer">Read the Codex integration documentation<ExternalLink size={13} /></a></section>
          </div>}
          <footer className="page-footer"><span><Mark small />A little more capable, every day.</span><span>Arnyx · Personal AI workspace</span></footer>
        </main>
        <aside className="right-rail">
          <Coordinator runtime={runtime} messages={state?.messages || []} job={job} onSend={send} onCancel={() => void cancel()} onExpand={() => setChatOpen(true)} />
          <section className="source-panel"><div className="section-title"><h3>On the radar</h3><button className="icon-button" onClick={() => setView('Crawlers')} aria-label="View all crawlers"><ArrowUpRight size={15} /></button></div><p>Four scouts, always a fresh perspective.</p>{state?.sources.map(source => <ScoutRow key={source.id} source={source} compact />)}<button className="source-footer" onClick={() => setView('Crawlers')}>{state?.settings.scheduled ? 'Auto-discovery is on' : 'Auto-discovery is paused'}<ChevronRight size={13} /></button></section>
          <section className="stack-tip"><div><span className="tip-icon"><Layers3 size={17} /></span><h3>Make it your own.</h3></div><p>Save what catches your eye. Build a stack that fits the way you work.</p><button onClick={() => setView('My stack')}>Open my stack<ArrowRight size={14} /></button></section>
          <div className="rail-footer"><ShieldCheck size={13} />Local workspace. Real source data.</div>
        </aside>
      </div>
    </div>

    {selected && <Modal title="Capability details" onClose={() => { if (!installBusy) setSelected(null) }} wide>
      <div className="detail-heading"><div className={'detail-icon ' + selected.accent}>{(() => { const Icon = kindIcons[selected.kind]; return <Icon size={30} /> })()}</div><div><span>{selected.owner} / {selected.kind.slice(0, -1)}</span><h2>{selected.name}</h2><p>{selected.compatibility}</p></div><button className="button secondary" onClick={() => void save(selected)}>{state?.saved.includes(selected.id) ? <Check size={15} /> : <Plus size={15} />}{state?.saved.includes(selected.id) ? 'Saved to stack' : 'Save to stack'}</button></div>
      <div className="detail-tabs" role="group" aria-label="Detail sections">{['Overview', 'Walkthrough', 'Setup'].map(tab => <button key={tab} className={detailTab === tab ? 'active' : ''} aria-pressed={detailTab === tab} onClick={() => setDetailTab(tab)}>{tab}</button>)}</div>
      <div className="detail-body">
        {detailTab === 'Overview' && <><p className="detail-description">{selected.description}</p><h3>What this adds to your workflow</h3><ul className="benefit-list">{selected.guide.benefits.map(benefit => <li key={benefit}><Check size={15} />{benefit}</li>)}</ul><div className="detail-metadata"><div><small>Category</small><strong>{selected.category}</strong></div><div><small>Source checked</small><strong>{relativeTime(selected.observedAt)}</strong></div><div><small>Repository stars</small><strong>{selected.stars == null ? 'Not checked' : shortNumber(selected.stars)}</strong></div><div><small>Version</small><strong>{selected.version || 'Not reported'}</strong></div></div>
          <details className="score-explanation"><summary>Discovery priority <strong>{selected.score.total}/100</strong><ChevronDown size={14} /></summary><p>A transparent metadata ranking, not a quality or security audit. Publisher signal {selected.score.publisher}/30, source documentation {selected.score.documentation}/20, repository adoption {selected.score.adoption}/30, source freshness {selected.score.freshness}/20. Repository freshness does not establish a skill’s release date.</p></details>
          <div className="detail-next"><span>See how it fits your next project.</span><button className="button primary" onClick={() => setDetailTab('Walkthrough')}>Start walkthrough<ArrowRight size={15} /></button></div></>}
        {detailTab === 'Walkthrough' && <><h3>A practical path to getting started</h3><ol className="walkthrough-steps">{selected.guide.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol><CodeBlock text={selected.guide.example} onCopy={text => void copy(text)} /><button className="button secondary try-prompt" onClick={() => { setSelected(null); setChatOpen(true); void send(selected.guide.example) }}>Discuss this with Arnyx<Orbit size={15} /></button></>}
        {detailTab === 'Setup' && <><h3>{selected.kind === 'Skills' ? 'Bring this skill into Codex' : 'Connect it to your workflow'}</h3><p className="muted">{selected.kind === 'Skills' ? 'Review the source files, then download a pinned version into this project. Your existing skills are preserved.' : 'Use the publisher’s instructions to configure the tool. Credentials and account connections stay under your control.'}</p>{selected.install ? <CodeBlock text={selected.install} label="Manual setup command" onCopy={text => void copy(text)} /> : <div className="manual-setup"><BookOpen size={22} /><p>This capability needs manual setup or adaptation. Follow the publisher’s compatibility and authentication guidance.</p></div>}
          {selected.kind === 'Skills' && selected.path && !review && <button className="button primary" onClick={() => void getReview()} disabled={reviewBusy || isInstalled(selected)}>{reviewBusy ? <Loader2 className="spin" size={15} /> : isInstalled(selected) ? <CheckCheck size={15} /> : <Download size={15} />}{reviewBusy ? 'Loading source review…' : isInstalled(selected) ? 'Already installed' : 'Review & add to Codex'}</button>}
          {review && <section className="install-review"><h3>Review the exact files</h3><p>{review.notice}</p><div className="review-facts"><span><GitBranch size={14} />{review.commit.slice(0, 12)}</span><span><FolderOpen size={14} />{review.files.length} files</span><span>{Math.ceil(review.bytes / 1024)} KB</span></div><p className="review-destination">Destination: <code>{review.destination}</code></p><details><summary>Read SKILL.md</summary><pre className="instruction-preview">{review.instructions}</pre></details><details><summary>View bundled files</summary><ul className="review-files">{review.files.map(file => <li key={file}>{file}</li>)}</ul></details><button className="button primary" disabled={installBusy} onClick={() => void install()}>{installBusy ? <Loader2 className="spin" size={15} /> : <Download size={15} />}{installBusy ? 'Downloading reviewed files…' : 'Add reviewed skill to Codex'}</button></section>}
          {reviewError && <div className="inline-error">{reviewError}</div>}</>}
        <div className="capability-caveat"><ShieldCheck size={17} /><p>{selected.guide.caveat}</p></div><a className="text-link" href={selected.url} target="_blank" rel="noreferrer">Open publisher source<ArrowUpRight size={14} /></a>
      </div>
    </Modal>}
    {chatOpen && <Modal title="Arnyx coordinator" onClose={() => setChatOpen(false)} wide><Coordinator runtime={runtime} messages={state?.messages || []} job={job} onSend={send} onCancel={() => void cancel()} onClear={() => void clearChat()} roomy /></Modal>}
    {commandOpen && <Modal title="Go anywhere" onClose={() => setCommandOpen(false)}><div className="command-menu"><p>Your workspace, one shortcut away.</p>{[...navigation, { name: 'Settings' as View, icon: Settings2 }].map(({ name, icon: Icon }) => <button key={name} onClick={() => { setView(name); setCommandOpen(false) }}><Icon size={18} /><span>{name}</span><ChevronRight size={14} /></button>)}<button onClick={() => { setCommandOpen(false); setChatOpen(true) }}><Orbit size={18} /><span>Ask the coordinator</span><ChevronRight size={14} /></button><button onClick={() => { setCommandOpen(false); void scan() }}><Radio size={18} /><span>Run discovery</span><ChevronRight size={14} /></button></div></Modal>}
    {compareOpen && <Modal title="Compare capabilities" onClose={() => setCompareOpen(false)} wide><div className="comparison-content"><p>Compare what each capability adds and how it fits Codex.</p><div className="comparison-table-wrap"><table><thead><tr><th>Capability</th>{compared.map(item => <th key={item.id}>{item.name}</th>)}</tr></thead><tbody><tr><th>Type</th>{compared.map(item => <td key={item.id}>{item.kind}</td>)}</tr><tr><th>Compatibility</th>{compared.map(item => <td key={item.id}>{item.compatibility}</td>)}</tr><tr><th>Advantages</th>{compared.map(item => <td key={item.id}><ul>{item.guide.benefits.map(benefit => <li key={benefit}>{benefit}</li>)}</ul></td>)}</tr><tr><th>Source checked</th>{compared.map(item => <td key={item.id}>{relativeTime(item.observedAt)}</td>)}</tr><tr><th>Discovery priority</th>{compared.map(item => <td key={item.id}>{item.score.total}/100</td>)}</tr><tr><th>Next step</th>{compared.map(item => <td key={item.id}><button className="button secondary" onClick={() => { setCompareOpen(false); open(item, 'Walkthrough') }}>Walkthrough<ArrowRight size={13} /></button></td>)}</tr></tbody></table></div></div></Modal>}
    <AnimatePresence>{comparison.length > 0 && !compareOpen && <motion.div className="compare-bar" initial={{ y: 70, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 70, opacity: 0 }}><Layers3 size={17} /><span>{comparison.length} selected</span><div>{compared.map(item => <button key={item.id} onClick={() => toggleCompare(item.id)}>{item.name}<X size={12} /></button>)}</div><button className="button primary" disabled={comparison.length < 2} onClick={() => setCompareOpen(true)}>Compare<ArrowRight size={14} /></button><button className="icon-button" aria-label="Clear comparison" onClick={() => setComparison([])}><X size={16} /></button></motion.div>}</AnimatePresence>
    <AnimatePresence>{toast && <motion.div role="status" className="toast" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}><Check size={16} />{toast}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={14} /></button></motion.div>}</AnimatePresence>
  </div>
}
function PlugIcon() { const Icon = kindIcons.Connectors; return <Icon size={17} /> }
