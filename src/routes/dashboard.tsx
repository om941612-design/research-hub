import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { FolderOpen, Plus, FileText } from "lucide-react";
import { toast } from "sonner";

type Corpus = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Research Assistant" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [session, loading, navigate]);

  const { data: corpora = [], isLoading } = useQuery({
    enabled: !!session,
    queryKey: ["corpora"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corpora")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Corpus[];
    },
  });

  async function createCorpus(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    const { error } = await supabase
      .from("corpora")
      .insert({ name, description: desc || null, user_id: user.id });
    setCreating(false);
    if (error) return toast.error(error.message);
    setName("");
    setDesc("");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["corpora"] });
  }

  if (loading || !session) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader email={user?.email} />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Your corpora
            </h1>
            <p className="text-muted-foreground mt-1">
              Project folders containing documents you can chat with.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> New corpus
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a corpus</DialogTitle>
              </DialogHeader>
              <form onSubmit={createCorpus} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name" value={name} onChange={(e) => setName(e.target.value)}
                    required placeholder="e.g. Q4 Market Research"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="desc">Description (optional)</Label>
                  <Textarea
                    id="desc" value={desc} onChange={(e) => setDesc(e.target.value)}
                    placeholder="What's in this corpus?"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : corpora.length === 0 ? (
          <EmptyState onCreate={() => setOpen(true)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {corpora.map((c) => (
              <Link
                key={c.id}
                to="/corpus/$id"
                params={{ id: c.id }}
                className="group rounded-2xl border border-border bg-card p-5 hover:border-accent/50 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary text-primary grid place-items-center group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground line-clamp-1">{c.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 min-h-[2.5rem]">
                  {c.description || "No description"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto h-12 w-12 rounded-xl bg-secondary text-primary grid place-items-center mb-4">
        <FileText className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-foreground">No corpora yet</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Create your first project folder to upload documents and start chatting.
      </p>
      <Button onClick={onCreate}>
        <Plus className="h-4 w-4" /> New corpus
      </Button>
    </div>
  );
}
