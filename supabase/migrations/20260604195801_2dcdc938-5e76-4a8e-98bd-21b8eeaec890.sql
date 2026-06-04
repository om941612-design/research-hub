ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing'
  CHECK (status IN ('processing','ready','error'));