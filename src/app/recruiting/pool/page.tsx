'use client'

export default function PoolPage() {
  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="bg-[#0D1B35] text-white px-6 py-4 border-b-[3px] border-[#D4A843]">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <a href="/hub" className="text-white/50 text-sm">← Hub</a>
          <div><div className="text-lg font-semibold">Candidate Pool</div><div className="text-xs text-white/50">Passed the initial interview · rated</div></div>
        </div>
        <div className="max-w-5xl mx-auto flex gap-1 mt-3">
          <a href="/recruiting" className="text-sm px-3 py-1.5 rounded-lg text-white/55 hover:text-white">New Queue</a>
          <a href="/recruiting/pool" className="text-sm px-3 py-1.5 rounded-lg bg-white/15 text-white font-medium">Candidate Pool</a>
          <a href="/recruiting/rejected" className="text-sm px-3 py-1.5 rounded-lg text-white/55 hover:text-white">Rejected</a>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-white border border-gray-100 rounded-xl p-10 text-center text-gray-500">
          The searchable Candidate Pool is coming next — with tier, position, and stage filters plus list/photo views.
        </div>
      </div>
    </div>
  )
}
