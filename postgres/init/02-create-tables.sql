-- Enable the vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  image TEXT,
  email_verified TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create transcriptions table
CREATE TABLE IF NOT EXISTS transcriptions (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  user_id TEXT,
  user_type TEXT,
  purpose TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for transcriptions
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_id ON transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_type ON transcriptions(user_type);
CREATE INDEX IF NOT EXISTS idx_transcriptions_purpose ON transcriptions(purpose);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transcriptions_updated_at
BEFORE UPDATE ON transcriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create a function for vector similarity search
CREATE OR REPLACE FUNCTION search_similar_chunks(
  query_embedding VECTOR(1536),
  similarity_threshold FLOAT,
  max_results INT
)
RETURNS TABLE (
  id INT,
  article_id INT,
  chunk_index INT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
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
    ac.embedding IS NOT NULL
  ORDER BY
    ac.embedding <=> query_embedding
  LIMIT max_results;
END;
$$;
