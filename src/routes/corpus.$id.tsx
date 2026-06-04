import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText, Upload, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Doc = { id: string; name: string; size_bytes: number; created_at: string };
type Msg = { id: string; role: "user" | "assistant"; content: string; created_at: string };

export const Route = createFileRoute("/corpus/$id")({
  head: () => ({ meta: [{ title: "Corpus — Research Assistant" }] }),
  component: CorpusView,
});

function CorpusView() {
  const { id } = Route.useParams();
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [session, loading, navigate]);

  const { data: corpus } = useQuery({
    enabled: !!session,
    queryKey: ["corpus", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corpora").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: docs = [] } = useQuery({
    enabled: !!session,
    queryKey: ["docs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents").select("*").eq("corpus_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  const { data: messages = [] } = useQuery({
    enabled: !!session,
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages").select("*").eq("corpus_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Msg[];
    },
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !user) return;
    const rows = Array.from(files).map((f) => ({
      corpus_id: id,
      user_id: user.id,
      name: f.name,
      size_bytes: f.size,
    }));
    const { error } = await supabase.from("documents").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} document${rows.length > 1 ? "s" : ""} added`);
    qc.invalidateQueries({ queryKey: ["docs", id] });
    if (fileInput.current) fileInput.current.value = "";
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      corpus_id: id, user_id: user.id, role: "user", content: text,
    });
    if (error) { setSending(false); return toast.error(error.message); }
    await supabase.from("messages").insert({
      corpus_id: id, user_id: user.id, role: "assistant",
      content: `Based on ${docs.length} document${docs.length === 1 ? "" : "s"} in this corpus, here's a placeholder response to: "${text}". Connect an AI model to enable real answers.`,
    });
    setSending(false);
    qc.invalidateQueries({ queryKey: ["messages", id] });
  }

  if (loading || !session) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader email={user?.email} />
      <div className="flex-1 flex max-w-6xl w-full mx-auto px-6 py-6 gap-6 min-h-0">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 flex flex-col rounded-2xl border border-border bg-card">
          <div className="p-4 border-b border-border">
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="h-3 w-3" /> All corpora
            </Link>
            <h2 className="font-semibold text-foreground line-clamp-1">
              {corpus?.name ?? "Corpus"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {docs.length} document{docs.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="p-4">
            <input
              ref={fileInput} type="file" multiple className="hidden"
              onChange={handleUpload}
            />
            <Button className="w-full" onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4" /> Upload documents
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center px-4 py-6">
                No documents yet.
              </p>
            ) : (
              docs.map((d) => (
                <div key={d.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-secondary text-sm">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(d.size_bytes)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Chat */}
        <section className="flex-1 flex flex-col rounded-2xl border border-border bg-card min-w-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-xl bg-accent/10 text-accent grid place-items-center mb-4">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-foreground">Ask anything about your corpus</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Upload documents on the left, then ask questions to get answers grounded in your sources.
                </p>
              </div>
            ) : (
              messages.map((m) => <Bubble key={m.id} msg={m} />)
            )}
          </div>
          <form onSubmit={send} className="border-t border-border p-4 flex gap-2">
            <Input
              value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your documents…"
              disabled={sending}
            />
            <Button type="submit" disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed " +
          (isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-secondary text-foreground rounded-bl-sm")
        }
      >
        {msg.content}
      </div>
    </div>
  );
}

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
