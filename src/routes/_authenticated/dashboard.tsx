import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Users, LayoutDashboard, Globe, ChevronRight, Loader2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { runAudit } from "@/lib/ai.functions";
import { AuditReport, type AuditResult } from "@/components/AuditReport";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Client = {
  id: string;
  url: string;
  addedAt: Date;
  auditResult: AuditResult | null;
};

function DashboardPage() {
  const auditFn = useServerFn(runAudit);
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem("arch_clients");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((c: any) => ({
          ...c,
          addedAt: new Date(c.addedAt)
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clients[0]?.id || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClientUrl, setNewClientUrl] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);

  useEffect(() => {
    localStorage.setItem("arch_clients", JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    if (window.location.hash === "#add-client") {
      setIsModalOpen(true);
      // clean hash without refreshing
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientUrl) return;

    let parsedUrl = newClientUrl;
    if (!parsedUrl.startsWith("http://") && !parsedUrl.startsWith("https://")) {
      parsedUrl = "https://" + parsedUrl;
    }

    try {
      new URL(parsedUrl); // Validate URL
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsAuditing(true);
    toast.info("Running live audit via AI engine...");

    try {
      const result = await auditFn({ data: { url: parsedUrl } });
      
      const newClient: Client = {
        id: crypto.randomUUID(),
        url: parsedUrl,
        addedAt: new Date(),
        auditResult: result as any,
      };

      setClients(prev => [newClient, ...prev]);
      setSelectedClientId(newClient.id);
      setIsModalOpen(false);
      setNewClientUrl("");
      toast.success("Client added and audit completed.");
    } catch (error) {
      toast.error("Failed to run audit.");
    } finally {
      setIsAuditing(false);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-48px)] -mx-12 -my-10 bg-background overflow-hidden relative">
      {/* Sidebar Layout */}
      <aside className="w-full md:w-64 md:border-r border-b md:border-b-0 border-border bg-card/30 flex flex-col md:h-full overflow-hidden shrink-0">
        <div className="p-4 border-b border-border">
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full h-10 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Client
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
            Client Hub
          </div>
          
          {clients.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
              No clients added yet.
            </div>
          ) : (
            clients.map((client) => (
              <button
                key={client.id}
                onClick={() => setSelectedClientId(client.id)}
                className={`w-full flex items-center justify-between p-2 rounded-md text-sm transition-colors ${
                  selectedClientId === client.id 
                    ? "bg-accent/10 text-accent font-medium border border-accent/20" 
                    : "text-foreground hover:text-accent hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Globe className={`h-4 w-4 shrink-0 ${selectedClientId === client.id ? 'text-accent' : 'opacity-70'}`} />
                  <span className="truncate">{new URL(client.url).hostname}</span>
                </div>
                {selectedClientId === client.id && <ChevronRight className="h-4 w-4 text-accent" />}
              </button>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-border mt-auto">
          <div className="bg-accent/10 border border-accent/20 rounded-md px-3 py-2 flex items-center justify-center">
            <span className="text-xs font-medium text-accent uppercase tracking-widest">Beta v0.1</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 bg-background">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-display font-bold text-foreground">Agency Dashboard</h1>
          </div>
          
          {clients.length === 0 ? (
            <div className="glass-card p-12 mt-12 rounded-2xl border border-border flex flex-col items-center justify-center text-center shadow-lg">
              <div className="bg-accent/10 p-4 rounded-full mb-6">
                <Globe className="h-16 w-16 text-accent" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Get Started with Your First Client</h2>
              <p className="text-muted-foreground max-w-md mb-8">
                Welcome to your Agency Engine. Add a client's website URL to run a real-time WCAG compliance audit and instantly generate remediation steps.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="h-11 px-8 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <Plus className="h-4 w-4" /> Add First Client
              </button>
            </div>
          ) : (
            <AuditReport 
              result={selectedClient?.auditResult || null} 
              clientUrl={selectedClient?.url || ""} 
            />
          )}
        </div>
      </main>

      {/* Add Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border shadow-2xl rounded-xl w-full max-w-md p-6 relative">
            <button 
              onClick={() => !isAuditing && setIsModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              disabled={isAuditing}
            >
              <X className="h-5 w-5" />
            </button>
            
            <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Add New Client
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Enter the client's URL. Our engine will instantly generate a compliance audit.
            </p>
            
            <form onSubmit={handleAddClient} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Client Website URL</label>
                <input
                  type="text"
                  placeholder="acme-corp.com"
                  className="w-full h-10 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
                  value={newClientUrl}
                  onChange={(e) => setNewClientUrl(e.target.value)}
                  disabled={isAuditing}
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={isAuditing || !newClientUrl}
                className="w-full h-10 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors inline-flex items-center justify-center disabled:opacity-60"
              >
                {isAuditing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Auditing site...
                  </>
                ) : "Run Compliance Audit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
