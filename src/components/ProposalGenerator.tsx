import React, { useState } from "react";
import { generateProposal, generateColdEmail } from "@/lib/ai.functions";
import { Clipboard, Check, Sparkles, AlertCircle } from "lucide-react";

interface ProposalGeneratorProps {
  auditId: string;
  url: string;
  violations: any[];
  clientName: string;
  clientIndustry: string;
}

export function ProposalGenerator({ auditId, url, violations, clientName, clientIndustry }: ProposalGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [email, setEmail] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const [proposalRes, emailRes] = await Promise.all([
        generateProposal({ auditId, url, violations, clientName, clientIndustry }),
        generateColdEmail({ clientName, url, violations })
      ]);
      setProposal(proposalRes);
      setEmail(emailRes);
    } catch (err) {
      console.error("Generation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-8 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="text-purple-500 w-6 h-6" />
          <h3 className="text-xl font-bold text-white tracking-tight">Closing Engine</h3>
        </div>
        <button 
          onClick={handleGenerate}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 text-white px-6 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
        >
          {loading ? "Synthesizing Strategy..." : "Generate Assets"}
        </button>
      </div>

      {loading && (
        <div className="grid md:grid-cols-2 gap-6 animate-pulse">
          <div className="h-48 bg-slate-800/50 rounded-xl"></div>
          <div className="h-48 bg-slate-800/50 rounded-xl"></div>
        </div>
      )}

      {proposal && email && (
        <div className="grid md:grid-cols-2 gap-6 animate-in fade-in zoom-in duration-300">
          {/* Proposal Card */}
          <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 hover:border-purple-500/30 transition-colors group">
            <h4 className="font-bold text-purple-400 mb-3 flex justify-between items-center">
              Executive Proposal
              <button onClick={() => copyToClipboard(proposal.executive_summary)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-800 rounded">
                {copied ? <Check size={14} className="text-green-500" /> : <Clipboard size={14} />}
              </button>
            </h4>
            <p className="text-slate-300 text-sm leading-relaxed">{proposal.executive_summary}</p>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-500 uppercase tracking-widest">Est. Investment</span>
              <p className="text-emerald-400 font-mono font-bold">{proposal.investment}</p>
            </div>
          </div>
          
          {/* Outreach Card */}
          <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 hover:border-blue-500/30 transition-colors group">
            <h4 className="font-bold text-blue-400 mb-3 flex justify-between items-center">
              Cold Outreach
              <button onClick={() => copyToClipboard(`Subject: ${email.subject}\n\n${email.body}`)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-800 rounded">
                 {copied ? <Check size={14} className="text-green-500" /> : <Clipboard size={14} />}
              </button>
            </h4>
            <div className="bg-slate-900 p-3 rounded border border-slate-800 mb-3">
              <div className="text-slate-400 text-xs font-mono mb-1 border-b border-slate-800 pb-1">Subject: {email.subject}</div>
              <p className="text-slate-300 whitespace-pre-line text-xs font-medium leading-relaxed">{email.body}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}