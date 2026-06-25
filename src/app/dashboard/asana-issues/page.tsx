'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import NavBar from '@/components/NavBar'

interface CachedTask {
  task_id: string
  name: string
  notes: string
  completed: boolean
  assignee: string | null
  due_on: string | null
  task_type: 'general_issue' | 'termination' | 'cover'
  updated_at: string
}

type FilterType = 'all' | 'general_issue' | 'termination'

export default function AsanaIssuesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tasks, setTasks] = useState<CachedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [syncMsg, setSyncMsg] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [showCompleted, setShowCompleted] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserEmail(data.user.email || '')
      loadTasks()
    })
  }, [])

  async function getToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }

  async function loadTasks() {
    setLoading(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/asana-issues', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTasks(data.tasks || [])
      const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      setLastRefreshed(now)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function syncFromAsana() {
    setSyncing(true)
    setSyncMsg('')
    setError('')
    try {
      const token = await getToken()
      const res = await fetch('/api/asana-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSyncMsg(`Synced ${data.synced} tasks — ${data.general_issues} issues, ${data.terminations} terminations`)
      await loadTasks()
    } catch (e: any) {
      setError(e.message)
    }
    setSyncing(false)
  }

  const filtered = tasks.filter(task => {
    if (filter !== 'all' && task.task_type !== filter) return false
    if (!showCompleted && task.completed) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return task.name.toLowerCase().includes(q) || task.notes?.toLowerCase().includes(q)
    }
    return true
  })

  const generalCount = tasks.filter(t => t.task_type === 'general_issue').length
  const terminationCount = tasks.filter(t => t.task_type === 'termination').length
  const openCount = tasks.filter(t => !t.completed).length

  function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function getAsanaUrl(taskId: string) {
    return `https://app.asana.com/0/0/${taskId}`
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <NavBar lang="en" onLangChange={() => {}} userEmail={userEmail} lastRefreshed={lastRefreshed} onRefresh={loadTasks} loading={loading} />

      <main className="px-5 py-4 max-w-5xl mx-auto">
        {/* Header */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-base font-semibold text-[#0D1B35]">Asana Issues</h1>
              <p className="text-xs text-gray-500 mt-0.5">General Issues & Terminations — all tiers</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={syncFromAsana} disabled={syncing}
                className="bg-[#D4A843] text-[#0D1B35] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#C49A38] transition-colors disabled:opacity-40 inline-flex items-center gap-2">
                {syncing
                  ? <><span className="animate-spin w-3 h-3 border border-[#0D1B35]/30 border-t-[#0D1B35] rounded-full" />Syncing…</>
                  : '⟳ Sync from Asana'}
              </button>
            </div>
          </div>
          {syncMsg && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-3">{syncMsg}</p>}
          {tasks.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Last synced: {lastRefreshed} · {tasks.length} tasks in cache
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="card p-4">
            <div className="text-2xl font-semibold text-[#0D1B35]">{tasks.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-semibold text-red-700">{openCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Open</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-semibold text-amber-700">{generalCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">General Issues</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-semibold text-purple-700">{terminationCount}</div>
            <div className="text-xs text-gray-500 mt-0.5">Terminations</div>
          </div>
        </div>

        {/* Filter + search */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex-wrap">
            <div className="flex gap-1.5">
              {([['all', `All (${tasks.length})`], ['general_issue', `General (${generalCount})`], ['termination', `Terminated (${terminationCount})`]] as [FilterType, string][]).map(([val, label]) => (
                <button key={val} onClick={() => setFilter(val)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${filter === val ? 'bg-[#0D1B35] text-white border-[#0D1B35]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-gray-200" />
            <button onClick={() => setShowCompleted(!showCompleted)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${showCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-500 border-gray-200'}`}>
              {showCompleted ? '✓ Showing completed' : 'Show completed'}
            </button>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 flex-1 max-w-xs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or notes…"
                className="border-none bg-transparent text-xs focus:outline-none w-full text-gray-700 placeholder-gray-400" />
              {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>}
            </div>
            <span className="text-xs text-gray-400 ml-auto">{filtered.length} tasks</span>
          </div>

          {loading ? (
            <div className="py-14 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <span className="animate-spin w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full" />
              Loading from cache…
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-gray-400 text-sm mb-3">No tasks in cache yet</p>
              <button onClick={syncFromAsana} disabled={syncing}
                className="bg-[#D4A843] text-[#0D1B35] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#C49A38] disabled:opacity-40">
                ⟳ Sync from Asana now
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-gray-400 text-sm">No tasks match this filter</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(task => {
                const isExpanded = expandedTask === task.task_id
                const isTermTask = task.task_type === 'termination'

                return (
                  <div key={task.task_id}>
                    <div
                      onClick={() => setExpandedTask(isExpanded ? null : task.task_id)}
                      className={`px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-gray-50/50 transition-colors ${isExpanded ? 'bg-blue-50/20' : ''} ${task.completed ? 'opacity-60' : ''}`}>
                      <span className={`text-gray-400 text-xs mt-0.5 transition-transform duration-150 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.name}</span>
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${isTermTask ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'}`}>
                            {isTermTask ? 'Termination' : 'General Issue'}
                          </span>
                          {task.completed && (
                            <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded flex-shrink-0">✓ Resolved</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                          {task.assignee && <span>👤 {task.assignee}</span>}
                          {task.due_on && <span>📅 Due {fmtDate(task.due_on)}</span>}
                          <span>Updated {fmtDate(task.updated_at)}</span>
                        </div>
                        {task.notes && !isExpanded && (
                          <p className="text-xs text-gray-500 mt-1 truncate">{task.notes}</p>
                        )}
                      </div>
                      <a href={getAsanaUrl(task.task_id)} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-[#D4A843] text-xs hover:underline flex-shrink-0">
                        ↗ Asana
                      </a>
                    </div>

                    {isExpanded && (
                      <div className="px-10 py-3 bg-blue-50/10 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {task.notes && (
                            <div className="col-span-2">
                              <div className="text-gray-400 mb-1 font-medium">Notes</div>
                              <div className="text-gray-800 whitespace-pre-wrap bg-white border border-gray-100 rounded-lg p-3 leading-relaxed">{task.notes}</div>
                            </div>
                          )}
                          {task.assignee && (
                            <div>
                              <div className="text-gray-400 mb-1">Assignee</div>
                              <div className="text-gray-800">{task.assignee}</div>
                            </div>
                          )}
                          {task.due_on && (
                            <div>
                              <div className="text-gray-400 mb-1">Due Date</div>
                              <div className="text-gray-800">{fmtDate(task.due_on)}</div>
                            </div>
                          )}
                          <div>
                            <div className="text-gray-400 mb-1">Status</div>
                            <div className={task.completed ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                              {task.completed ? '✓ Resolved' : '● Open'}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-400 mb-1">Last Synced</div>
                            <div className="text-gray-800">{fmtDate(task.updated_at)}</div>
                          </div>
                          <div className="col-span-2">
                            <a href={getAsanaUrl(task.task_id)} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[#D4A843] hover:underline font-medium">
                              ↗ Open in Asana
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
