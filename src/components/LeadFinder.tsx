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

  useEffect(() => {
    if (!loading) return;
    const stages = [
      "Connecting to local business registries...",
      "Extracting top search-ranking assets...",
      "Analyzing DOM structures for WCAG liabilities...",
      "Compiling compliance risk directory..."
    ];
    let i = 0;
    setLoadingStage(stages[0]);
    const interval = setInterval(() => {
      i++;
      if (i < stages.length) setLoadingStage(stages[i]);
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
      setError(err.message || "Failed to query lead directories.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuditTrigger = async (url: string, id: string) => {
    setAuditingRowId(id);
    try {
      await onSelectUrl(url);
    } finally {
      setAuditingRowId(null);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Lead Discovery Pipeline</h2>
        <p className="text-slate-400 text-sm">Find local businesses with poor accessibility scores in any market.</p>
      </div>
      <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Industry</label>
          <input
            type="text"
            placeholder="e.g. Dentists, Law Firms, Hotels"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 text-sm"
            required
            disabled={loading}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Location</label>
          <input
            type="text"
            placeholder="e.g. Sydney, London, Toronto"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 text-sm"
            required
            disabled={loading}
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/40 text-white px-8 py-2.5 rounded-lg font-semibold text-sm h-[42px] min-w-[160px] flex items-center justify-center gap-2"
          >
            {loading ? "Scanning..." : "Find Leads"}
          </button>
        </div>
      </form>
      {error && (
        <div className="p-4 mb-4 bg-red-950/40 border border-red-900/50 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}
      {loading && (
        <div className="text-center py-12 border border-slate-800 rounded-xl bg-slate-950/20">
          <p className="text-sm text-slate-300 animate-pulse">{loadingStage}</p>
        </div>
      )}
      {!loading && leads.length > 0 && (
        <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-800/40 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4">Business</th>
                <th className="p-4">Find Website</th>
                <th className="p-4">Ranking</th>
                <th className="p-4">Top Issue</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-slate-900 hover:bg-slate-800/20">
                  <td className="p-4 font-semibold text-slate-200">{lead.name}</td>
                  <td className="p-4">
                    <a
                      href={"https://www.google.com/search?q=" + encodeURIComponent(lead.name + " " + location + " official website")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 underline hover:text-purple-300 text-xs"
                    >
                      Search on Google
                    </a>
                  </td>
                  <td className="p-4">
                    <span className="text-purple-400 text-xs bg-purple-950/40 border border-purple-900/30 px-2 py-0.5 rounded">
                      {lead.ranking}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-slate-400">{lead.common_flaw}</td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      disabled={auditingRowId !== null}
                      onClick={() => handleAuditTrigger(lead.website, lead.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs px-3 py-2 rounded-md font-semibold min-w-[100px]"
                    >
                      {auditingRowId === lead.id ? "Auditing..." : "Run Audit"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && leads.length === 0 && (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
          <p className="text-slate-500 text-sm">Enter an industry and location to find leads.</p>
        </div>
      )}
    </div>
  );
}