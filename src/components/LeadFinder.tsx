import React, { useState } from "react";
import { searchLeads } from "@/lib/ai.functions";

interface LeadFinderProps {
  onSelectUrl: (url: string) => void;
}

export function LeadFinder({ onSelectUrl }: LeadFinderProps) {
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!industry.trim() || !location.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await searchLeads({ data: { industry, location } });
      setLeads(data);
    } catch (err: any) {
      console.error("Error fetching leads:", err);
      setError(err.message || "Failed to search leads. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-2xl font-bold tracking-tight">🚀 Lead Discovery Engine</h2>
          <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs px-2 py-0.5 rounded-full font-semibold">
            Premium Feature
          </span>
        </div>
        <p className="text-slate-400 text-sm">
          Scan local markets to pinpoint high-traffic businesses suffering from critical WCAG compliance gaps.
        </p>
      </div>
      
      <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input 
            type="text" 
            placeholder="e.g. Real Estate, E-commerce, Medical" 
            value={industry} 
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 px-4 py-2.5 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition text-sm"
            required
          />
        </div>
        <div className="flex-1">
          <input 
            type="text" 
            placeholder="e.g. Chicago, London, Mumbai" 
            value={location} 
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 px-4 py-2.5 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition text-sm"
            required
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/50 text-white px-6 py-2.5 rounded-lg font-medium transition text-sm shadow-lg shadow-purple-600/10 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? "Scanning Assets..." : "Find Broken Sites"}
        </button>
      </form>

      {error && (
        <div className="p-4 mb-6 bg-red-900/20 border border-red-800/40 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {leads.length > 0 ? (
        <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-800/60 border-b border-slate-800 text-slate-300 font-medium">
                <th className="p-4">Business Name</th>
                <th className="p-4">Target Website</th>
                <th className="p-4">Search Presence</th>
                <th className="p-4">Primary Vulnerability</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-slate-900 hover:bg-slate-800/30 transition">
                  <td className="p-4 font-semibold text-slate-200">{lead.name}</td>
                  <td className="p-4 text-slate-400 font-mono text-xs">{lead.website}</td>
                  <td className="p-4 text-purple-400 font-medium">{lead.ranking}</td>
                  <td className="p-4">
                    <span className="bg-red-950/60 text-red-400 border border-red-900/50 px-2 py-1 rounded text-xs font-medium inline-block mb-1">
                      ⚠️ {lead.status}
                    </span>
                    <div className="text-[11px] text-slate-500 font-mono tracking-tight">{lead.common_flaw}</div>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      type="button"
                      onClick={() => onSelectUrl(lead.website)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-2 rounded-md font-semibold transition tracking-wide shadow-md shadow-emerald-900/20"
                    >
                      Run AI Audit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
            <p className="text-slate-500 text-sm">Enter an industry and city above to extract highly targeted prospects.</p>
          </div>
        )
      )}
    </div>
  );
}