-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  source TEXT,
  url TEXT,
  author TEXT,
  published_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create article_chunks table with vector support
CREATE TABLE IF NOT EXISTS article_chunks (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_articles_title ON articles USING GIN (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_article_chunks_content ON article_chunks USING GIN (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_article_chunks_article_id ON article_chunks(article_id);
CREATE INDEX IF NOT EXISTS idx_article_chunks_article_id_chunk_index ON article_chunks(article_id, chunk_index);

-- Create vector index for embeddings
CREATE INDEX IF NOT EXISTS idx_article_chunks_embedding ON article_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create function to search for similar chunks
CREATE OR REPLACE FUNCTION search_similar_chunks(query_embedding VECTOR(1536), similarity_threshold FLOAT, max_results INT)
RETURNS TABLE (
  id INTEGER,
  article_id INTEGER,
  chunk_index INTEGER,
  content TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.id,
    ac.article_id,
    ac.chunk_index,
    ac.content,
    1 - (ac.embedding <=> query_embedding) AS similarity
  FROM
    article_chunks ac
  WHERE
    1 - (ac.embedding <=> query_embedding) > similarity_threshold
  ORDER BY
    ac.embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
