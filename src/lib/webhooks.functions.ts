import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const INGEST_URL = () => process.env.INGEST_WEBHOOK_URL;
const QUERY_URL = () => process.env.QUERY_WEBHOOK_URL;
const SHARED_SECRET = () => process.env.WEBHOOK_SHARED_SECRET;

function authHeaders(): Record<string, string> {
  const s = SHARED_SECRET();
  return s ? { "x-webhook-secret": s } : {};
}

export const ingestDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as {
      corpusId?: string;
      documentId?: string;
      filename?: string;
      contentType?: string;
      base64?: string;
    };
    if (!d?.corpusId || !d.documentId || !d.filename || !d.base64) {
      throw new Error("Missing required fields");
    }
    if (d.corpusId.length > 64 || d.documentId.length > 64 || d.filename.length > 512) {
      throw new Error("Invalid field length");
    }
    return {
      corpusId: d.corpusId,
      documentId: d.documentId,
      filename: d.filename,
      contentType: d.contentType || "application/octet-stream",
      base64: d.base64,
    };
  })
  .handler(async ({ data, context }) => {
    const url = INGEST_URL();
    if (!url) throw new Error("Ingest webhook not configured");
    const { supabase, userId } = context;

    // Verify the document belongs to this user (RLS scoped)
    const { data: doc, error } = await supabase
      .from("documents")
      .select("id, corpus_id")
      .eq("id", data.documentId)
      .maybeSingle();
    if (error || !doc || doc.corpus_id !== data.corpusId) {
      throw new Error("Document not found");
    }

    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 50 * 1024 * 1024) throw new Error("File too large");

    const fd = new FormData();
    fd.append(
      "file",
      new Blob([bytes as BlobPart], { type: data.contentType }),
      data.filename,
    );
    fd.append("corpus_id", data.corpusId);
    fd.append("document_id", data.documentId);
    fd.append("user_id", userId);

    const res = await fetch(url, { method: "POST", body: fd, headers: authHeaders() });
    if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
    return { ok: true };
  });

export const queryCorpus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as { corpusId?: string; question?: string };
    if (!d?.corpusId || !d.question) throw new Error("Missing required fields");
    if (d.corpusId.length > 64) throw new Error("Invalid corpusId");
    if (d.question.length > 4000) throw new Error("Question too long");
    return { corpusId: d.corpusId, question: d.question };
  })
  .handler(async ({ data, context }) => {
    const url = QUERY_URL();
    if (!url) throw new Error("Query webhook not configured");
    const { supabase, userId } = context;

    // Verify corpus ownership via RLS
    const { data: corpus, error } = await supabase
      .from("corpora")
      .select("id")
      .eq("id", data.corpusId)
      .maybeSingle();
    if (error || !corpus) throw new Error("Corpus not found");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        question: data.question,
        corpus_id: data.corpusId,
        user_id: userId,
        conversation_id: data.corpusId,
      }),
    });
    if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
    const json = (await res.json().catch(() => ({}))) as { answer?: string };
    return { answer: json.answer ?? "No answer returned." };
  });
