import React, { useState, useEffect } from "react";
import { searchLeads } from "@/lib/ai.functions";

interface LeadFinderProps {
  onSelectUrl: (url: string) => void;
}

export function LeadFinder({ onSelectUrl }: LeadFinderProps) {
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [auditingRowId, setAuditingRowId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Premium loading stage simulator for high perceived value
  useEffect(() => {
    if (!loading) return;
    const stages = [
      "Connecting to local business registries...",
      "Extracting top search-ranking assets...",
      "Analyzing remote DOM structures for WCAG liabilities...",
      "Compiling compliance risk directory..."
    ];
    
    let currentStage = 0;
    setLoadingStage(stages[0]);
    
    const interval = setInterval(() => {
      currentStage++;
      if (currentStage < stages.length) {
        setLoadingStage(stages[currentStage]);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [loading]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!industry.trim() || !location.trim()) return;
    
    setLoading(true);
    setError(null);
    setLeads([]);
    
    try {
      const data = await searchLeads({ data: { industry, location } });
      setLeads(data);
    } catch (err: any) {
      console.error("Error fetching leads:", err);
      setError(err.message || "Failed to query lead directories.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuditTrigger = async (url: string, id: string) => {
    setAuditingRowId(id);
    try {
      await onSelectUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditingRowId(null);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-xl transition-all duration-300">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-400 bg-clip-text text-transparent">
              🚀 Lead Discovery Pipeline
            </h2>
            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs px-2.5 py-0.5 rounded-full font-semibold tracking-wide animate-pulse">
              PRO TIER
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Scan local corporate markets to extract high-traffic assets operating with severe regulatory compliance vulnerabilities.
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Target Industry</label>
          <input 
            type="text" 
            placeholder="e.g. Real Estate, Medical, Law Firms" 
            value={industry} 
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition text-sm"
            required
            disabled={loading}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Geographic Location</label>
          <input 
            type="text" 
            placeholder="e.g. Chicago, London, Sydney" 
            value={location} 
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition text-sm"
            required
            disabled={loading}
          />
        </div>
        <div className="flex items-end">
          <button 
            type="submit" 
            disabled={loading}
            className="w-full md:w-auto bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/40 text-white px-8 py-2.5 rounded-lg font-semibold transition text-sm shadow-lg shadow-purple-600/10 disabled:cursor-not-allowed h-[42px] flex items-center justify-center min-w-[160px]"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Scanning...</span>
              </div>
            ) : "Extract Market Leads"}
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 mb-6 bg-red-950/40 border border-red-900/50 text-red-400 rounded-lg text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-16 border border-slate-800 rounded-xl bg-slate-950/20 flex flex-col items-center justify-center gap-3">
          <div className="p-3 bg-purple-600/10 rounded-full text-purple-400 animate-bounce">
            🔍
          </div>
          <p className="text-sm font-medium text-slate-300 transition-all duration-300 animate-pulse">{loadingStage}</p>
          <p className="text-xs text-slate-500">This usually takes around 5 seconds</p>
        </div>
      )}

      {!loading && leads.length > 0 && (
        <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40 opacity-0 animate-[fadeIn_0.4s_ease-out_forwards]">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800/40 border-b border-slate-800 text-slate-400 font-medium text-xs tracking-wider uppercase">
                <th className="p-4">Business Name</th>
                <th className="p-4">Target Website</th>
                <th className="p-4">Search Standing</th>
                <th className="p-4">Vulnerability Matrix</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-slate-900 hover:bg-slate-800/20 transition-all">
                  <td className="p-4 font-semibold text-slate-200">{lead.name}</td>
                  <td className="p-4 text-slate-400 font-mono text-xs">{lead.website}</td>
                  <td className="p-4">
                    <span className="text-purple-400 font-medium text-xs bg-purple-950/40 border border-purple-900/30 px-2 py-0.5 rounded">
                      {lead.ranking}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="bg-red-950/60 text-red-400 border border-red-900/40 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide inline-block mb-1">
                      CRITICAL EXPOSURE
                    </span>
                    <div className="text-[11px] text-slate-400 font-mono tracking-tight">{lead.common_flaw}</div>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      type="button"
                      disabled={auditingRowId !== null}
                      onClick={() => handleAuditTrigger(lead.website, lead.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs px-3 py-2 rounded-md font-semibold transition tracking-wide shadow-md shadow-emerald-900/10 min-w-[100px] inline-flex items-center justify-center gap-1.5"
                    >
                      {auditingRowId === lead.id ? (
                        <>
                          <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Auditing...</span>
                        </>
                      ) : "Run AI Audit"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && leads.length === 0 && (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
          <p className="text-slate-500 text-sm">Define target industry metrics and geographic operational sectors above to extract premium pipeline prospects.</p>
        </div>
      )}
    </div>
  );
}