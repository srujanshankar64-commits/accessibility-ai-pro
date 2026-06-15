import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/share/$auditId")({
  component: SharedAuditPage,
});

function scorePill(n) {
  if (n >= 65) return "bg-[#f1faf4] text-[#1a7f3c]";
  if (n >= 45) return "bg-[#fff8ee] text-[#b47a0a]";
  return "bg-[#fff2f2] text-[#c0392b]";
}
function severityColor(s) {
  if (s === "critical") return "bg-[#fff2f2] text-[#c0392b]";
  if (s === "serious") return "bg-[#fff8ee] text-[#b47a0a]";
  if (s === "moderate") return "bg-[#e8f1fd] text-[#0071e3]";
  return "bg-[#f5f5f7] text-[#6e6e73]";
}

function SharedAuditPage() {
  const { auditId } = Route.useParams();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("audits").select("id,url,overall_score,violations,created_at")
        .eq("id", auditId).maybeSingle();
      if (error || !data) setNotFound(true);
      else setAudit(data);
      setLoading(false);
    })();
  }, [auditId]);

  if (loading) return <div style={{minHeight:"100vh",background:"#f5f5f7",display:"flex",alignItems:"center",justifyContent:"center"}}><p style={{color:"#6e6e73",fontSize:14}}>Loading report...</p></div>;
  if (notFound) return (
    <div style={{minHeight:"100vh",background:"#f5f5f7",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",border:"0.5px solid #d2d2d7",borderRadius:16,padding:"48px 40px",textAlign:"center",maxWidth:400}}>
        <AlertTriangle size={32} color="#ff9500" style={{margin:"0 auto 16px"}} />
        <h1 style={{fontSize:18,fontWeight:500,color:"#1d1d1f",marginBottom:8}}>Report not found</h1>
        <p style={{fontSize:13,color:"#6e6e73"}}>This link may be invalid or the audit was deleted.</p>
      </div>
    </div>
  );

  const violations = audit.violations ?? [];
  return (
    <div style={{minHeight:"100vh",background:"#f5f5f7",fontFamily:"Inter,sans-serif"}}>
      <nav style={{height:48,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(24px)",borderBottom:"0.5px solid #d2d2d7",display:"flex",alignItems:"center",padding:"0 28px",gap:10,position:"sticky",top:0,zIndex:100}}>
        <div style={{width:26,height:26,background:"#1d1d1f",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}><ShieldCheck size={13} color="#fff" /></div>
        <span style={{fontSize:14,fontWeight:500,color:"#1d1d1f"}}>AccessAudit <span style={{fontWeight:200,color:"#6e6e73"}}>AI</span></span>
        <span style={{marginLeft:"auto",fontSize:11,color:"#86868b",background:"#f5f5f7",border:"0.5px solid #d2d2d7",padding:"4px 12px",borderRadius:20}}>Client Report</span>
      </nav>
      <div style={{maxWidth:760,margin:"0 auto",padding:"40px 24px"}}>
        <div style={{background:"#fff",border:"0.5px solid #d2d2d7",borderRadius:16,padding:"28px 32px",marginBottom:20}}>
          <p style={{fontSize:10,fontWeight:500,letterSpacing:".07em",color:"#aeaeb2",textTransform:"uppercase",marginBottom:8}}>WCAG 2.1 Compliance Report</p>
          <h1 style={{fontSize:24,fontWeight:200,color:"#1d1d1f",marginBottom:4}}>{audit.url}</h1>
          <p style={{fontSize:12,color:"#aeaeb2"}}>Scanned {new Date(audit.created_at).toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"})}</p>
          <div style={{marginTop:20,display:"flex",alignItems:"center",gap:16}}>
            <span style={{fontSize:36,fontWeight:200,color:"#1d1d1f"}}>{audit.overall_score}<span style={{fontSize:18,color:"#aeaeb2"}}>/100</span></span>
            <div>
              <span className={cn("text-sm font-medium px-3 py-1 rounded-lg", scorePill(audit.overall_score))}>
                {audit.overall_score >= 65 ? "Passing" : audit.overall_score >= 45 ? "Needs Work" : "Failing"}
              </span>
              <p style={{fontSize:11,color:"#aeaeb2",marginTop:4}}>{violations.length} violations found</p>
            </div>
          </div>
        </div>
        <div style={{background:"#fff",border:"0.5px solid #d2d2d7",borderRadius:16,overflow:"hidden"}}>
          <div style={{background:"#f9f9f9",borderBottom:"0.5px solid #e8e8ed",padding:"12px 24px"}}>
            <p style={{fontSize:10,fontWeight:500,letterSpacing:".07em",color:"#aeaeb2",textTransform:"uppercase"}}>Violations</p>
          </div>
          {violations.map((v, i) => (
            <div key={i} style={{padding:"16px 24px",borderBottom:"0.5px solid #f2f2f2"}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0 mt-0.5", severityColor(v.severity))}>{v.severity||"moderate"}</span>
                <div>
                  <p style={{fontSize:13,fontWeight:500,color:"#1d1d1f",marginBottom:4}}>{v.name}</p>
                  <p style={{fontSize:12,color:"#6e6e73",lineHeight:1.6}}>{v.description}</p>
                  <p style={{fontSize:10,color:"#aeaeb2",marginTop:4,fontFamily:"monospace"}}>{v.wcag_criterion}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p style={{textAlign:"center",fontSize:11,color:"#aeaeb2",marginTop:24}}>Report by <a href="https://accessibility-ai-pro.lovable.app" style={{color:"#0071e3",textDecoration:"none"}}>AccessAudit AI</a></p>
      </div>
    </div>
  );
}
export default SharedAuditPage;
