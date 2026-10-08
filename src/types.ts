export type Kind = 'Skills' | 'Connectors' | 'Plugins' | 'Harnesses'
export type View = 'Discover' | 'My stack' | 'Crawlers' | 'Walkthroughs' | 'Activity' | 'Settings'
export interface Capability {
  id: string; name: string; kind: Kind; category: string; owner: string; repo?: string; path?: string
  description: string; accent: string; featured?: boolean; icon: string; tags: string[]
  url: string; compatibility: string; install: string | null; stars?: number | null
  observedAt?: string | null; updatedAt?: string | null; version?: string; skillName?: string
  guide: { benefits: string[]; steps: string[]; example: string; caveat: string }
  score: { total: number; publisher: number; documentation: number; adoption: number; freshness: number }
}
export interface Scout {
  id: string; name: string; subtitle: string; url: string; kind: Kind
  status: 'idle' | 'running' | 'complete' | 'error' | 'partial'
  lastRun?: string; found: number; error?: string
}
export interface Activity { id: string; at: string; type: string; message: string }
export interface Message { id: string; role: 'user' | 'assistant'; content: string; at?: string }
export interface Job { id: string; status: 'running' | 'complete' | 'error' | 'cancelled'; answer: string; error: string; progress: string }
export interface AppState {
  catalog: Capability[]; sources: Scout[]; saved: string[]; events: Activity[]; messages: Message[]
  settings: { scheduled: boolean; intervalMinutes: number }; crawling: boolean; activeJob: Partial<Job>
}
export interface Runtime {
  available: boolean; authenticated: boolean; version?: string; message: string; provider: string; sandbox: string
  installedSkills: { name: string; folder: string; scope: string }[]
  connections: { name: string; enabled: boolean; authStatus: string }[]; connectionsUnavailable?: boolean
}
export interface Review {
  reviewId: string; commit: string; files: string[]; instructions: string
  folder: string; bytes: number; destination: string; notice: string
}
