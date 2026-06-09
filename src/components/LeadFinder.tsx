<tbody>
  {leads.map((lead) => (
    <tr key={lead.id} className="border-b border-slate-900 hover:bg-slate-800/20 transition-all group">
      <td className="p-4 font-semibold text-slate-200">{lead.name}</td>
      <td className="p-4 text-slate-400 font-mono text-xs hover:text-purple-400 transition-colors">
        {lead.website}
      </td>
      <td className="p-4 text-slate-400 text-xs">{lead.ranking}</td>
      <td className="p-4">
        {/* Elite Score Matrix */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${lead.score < 50 ? 'bg-red-500' : 'bg-emerald-500'}`} 
              style={{ width: `${lead.score}%` }} 
            />
          </div>
          <span className={`text-xs font-bold ${lead.score < 50 ? 'text-red-400' : 'text-emerald-400'}`}>
            {lead.score}/100
          </span>
        </div>
        <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
          {lead.common_flaw}
        </div>
      </td>
      <td className="p-4 text-right">
        <button 
          type="button"
          disabled={auditingRowId !== null}
          onClick={() => handleAuditTrigger(lead.website, lead.id)}
          className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white text-xs px-4 py-2 rounded-md font-semibold transition tracking-wide shadow-lg shadow-purple-900/20"
        >
          {auditingRowId === lead.id ? "Analyzing..." : "Perform Deep Audit"}
        </button>
      </td>
    </tr>
  ))}
</tbody>