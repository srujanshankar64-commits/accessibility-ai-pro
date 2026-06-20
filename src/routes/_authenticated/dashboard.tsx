import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Users, LayoutDashboard, Globe, ChevronRight, Loader2, X } from "lucide-react";
import { runAudit, type AuditResult } from "@/lib/audit-mock";
import { AuditReport } from "@/components/AuditReport";
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
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClientUrl, setNewClientUrl] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);

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
    toast.info("Running real-time audit simulation...");

    try {
      const result = await runAudit(parsedUrl);
      
      const newClient: Client = {
        id: crypto.randomUUID(),
        url: parsedUrl,
        addedAt: new Date(),
        auditResult: result,
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
    <div className="flex h-[calc(100vh-48px)] -mx-12 -my-10 bg-background overflow-hidden border-t border-border">
      {/* Sidebar Layout */}
      <aside className="w-64 border-r border-border bg-card/30 flex flex-col">
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
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Globe className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate">{new URL(client.url).hostname}</span>
                </div>
                {selectedClientId === client.id && <ChevronRight className="h-4 w-4 opacity-70" />}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 bg-background">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-display font-bold text-foreground">Agency Dashboard</h1>
          </div>
          
          <AuditReport 
            result={selectedClient?.auditResult || null} 
            clientUrl={selectedClient?.url || ""} 
          />
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
