-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embeddings column to assets table
ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create index for faster vector similarity search
CREATE INDEX IF NOT EXISTS assets_embedding_idx ON public.assets 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);