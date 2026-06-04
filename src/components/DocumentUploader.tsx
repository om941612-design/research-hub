import { useRef, useState } from "react";
import { Upload, FileText, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type DocStatus = "processing" | "ready" | "error";
export type Doc = {
  id: string;
  name: string;
  size_bytes: number;
  status: DocStatus;
  created_at: string;
};

const MAX_SIZE = 50 * 1024 * 1024;
const ACCEPT = ".pdf,.docx,.txt";
const ACCEPT_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const WEBHOOK_URL = import.meta.env.VITE_INGEST_WEBHOOK_URL as string | undefined;

function validate(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const okExt = ext === "pdf" || ext === "docx" || ext === "txt";
  if (!okExt && !ACCEPT_MIME.has(file.type)) {
    return `${file.name}: only PDF, DOCX, or TXT files are allowed.`;
  }
  if (file.size > MAX_SIZE) {
    return `${file.name}: exceeds the 50MB limit.`;
  }
  return null;
}

export function DocumentUploader({
  corpusId,
  userId,
  docs,
}: {
  corpusId: string;
  userId: string;
  docs: Doc[];
}) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function uploadOne(file: File) {
    const { data, error } = await supabase
      .from("documents")
      .insert({
        corpus_id: corpusId,
        user_id: userId,
        name: file.name,
        size_bytes: file.size,
        status: "processing",
      })
      .select()
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Failed to create document record");
      return;
    }
    qc.invalidateQueries({ queryKey: ["docs", corpusId] });

    if (!WEBHOOK_URL) {
      await supabase.from("documents").update({ status: "error" }).eq("id", data.id);
      qc.invalidateQueries({ queryKey: ["docs", corpusId] });
      toast.error("Ingest webhook URL is not configured.");
      return;
    }

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("corpus_id", corpusId);
      fd.append("document_id", data.id);
      const res = await fetch(WEBHOOK_URL, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      await supabase.from("documents").update({ status: "ready" }).eq("id", data.id);
    } catch (e) {
      await supabase.from("documents").update({ status: "error" }).eq("id", data.id);
      toast.error(`${file.name}: ${(e as Error).message}`);
    } finally {
      qc.invalidateQueries({ queryKey: ["docs", corpusId] });
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const valid: File[] = [];
    for (const f of list) {
      const err = validate(f);
      if (err) toast.error(err);
      else valid.push(f);
    }
    if (!valid.length) return;
    await Promise.all(valid.map(uploadOne));
  }

  async function deleteDoc(id: string) {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["docs", corpusId] });
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="p-4 space-y-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
          }}
          className={
            "rounded-xl border-2 border-dashed p-4 text-center transition-colors " +
            (dragOver
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent/50 bg-secondary/30")
          }
        >
          <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-foreground font-medium">Drop files here</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            PDF, DOCX, TXT · up to 50MB
          </p>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files);
              if (fileInput.current) fileInput.current.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 w-full"
            onClick={() => fileInput.current?.click()}
          >
            Browse files
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center px-4 py-6">
            No documents yet.
          </p>
        ) : (
          docs.map((d) => <DocRow key={d.id} doc={d} onDelete={() => deleteDoc(d.id)} />)
        )}
      </div>
    </div>
  );
}

function DocRow({ doc, onDelete }: { doc: Doc; onDelete: () => void }) {
  return (
    <div className="group flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-secondary text-sm">
      <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-foreground">{doc.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <StatusBadge status={doc.status} />
          <span className="text-xs text-muted-foreground">{formatSize(doc.size_bytes)}</span>
        </div>
      </div>
      <button
        onClick={onDelete}
        aria-label={`Delete ${doc.name}`}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: DocStatus }) {
  const map = {
    processing: {
      label: "Processing",
      cls: "bg-accent/10 text-accent",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    ready: {
      label: "Ready",
      cls: "bg-emerald-100 text-emerald-700",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    error: {
      label: "Error",
      cls: "bg-destructive/10 text-destructive",
      icon: <AlertCircle className="h-3 w-3" />,
    },
  }[status];
  return (
    <span
      className={
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium " + map.cls
      }
    >
      {map.icon}
      {map.label}
    </span>
  );
}

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
