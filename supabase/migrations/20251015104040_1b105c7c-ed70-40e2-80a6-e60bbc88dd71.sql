-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION search_assets_by_embedding(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  tenant_filter uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  file_type text,
  file_size bigint,
  tags text[],
  created_at timestamptz,
  folder_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.description,
    a.file_type,
    a.file_size,
    a.tags,
    a.created_at,
    a.folder_id,
    1 - (a.embedding <=> query_embedding) as similarity
  FROM assets a
  WHERE 
    a.tenant_id = tenant_filter
    AND a.embedding IS NOT NULL
    AND 1 - (a.embedding <=> query_embedding) > match_threshold
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;