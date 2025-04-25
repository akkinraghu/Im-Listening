import { executeQuery } from '@/lib/postgres';

export interface PgArticleChunk {
  id: number;
  article_id: number;
  content: string;
  chunk_index: number;
  embedding: number[];
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
}

export interface SearchResult {
  chunk_id: number;
  article_id: number;
  content: string;
  chunk_index: number;
  distance: number;
  title: string;
  source: string;
  url?: string;
  author?: string;
  published_date?: Date;
}

export class ArticleChunkPg {
  // Get chunk by ID
  static async findById(id: number): Promise<PgArticleChunk | null> {
    const chunks = await executeQuery<PgArticleChunk>(
      'SELECT * FROM article_chunks WHERE id = $1',
      [id]
    );
    
    return chunks.length > 0 ? chunks[0] : null;
  }
  
  // Get chunks by article ID
  static async findByArticleId(articleId: number): Promise<PgArticleChunk[]> {
    return executeQuery<PgArticleChunk>(
      'SELECT * FROM article_chunks WHERE article_id = $1 ORDER BY chunk_index',
      [articleId]
    );
  }
  
  // Create a new chunk
  static async create(chunk: Omit<PgArticleChunk, 'id' | 'created_at' | 'updated_at'>): Promise<PgArticleChunk> {
    const result = await executeQuery<PgArticleChunk>(
      `INSERT INTO article_chunks 
       (article_id, content, chunk_index, embedding, metadata) 
       VALUES ($1, $2, $3, $4::vector, $5) 
       RETURNING *`,
      [
        chunk.article_id,
        chunk.content,
        chunk.chunk_index,
        JSON.stringify(chunk.embedding),
        chunk.metadata ? JSON.stringify(chunk.metadata) : null
      ]
    );
    
    return result[0];
  }
  
  // Update a chunk
  static async update(id: number, updates: Partial<Omit<PgArticleChunk, 'id' | 'created_at' | 'updated_at'>>): Promise<PgArticleChunk | null> {
    // Build the SET part of the query dynamically based on provided updates
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'embedding') {
          updateFields.push(`${key} = $${paramIndex}::vector`);
          values.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = $${paramIndex}`);
          values.push(key === 'metadata' ? JSON.stringify(value) : value);
        }
        paramIndex++;
      }
    });
    
    // Add the updated_at timestamp
    updateFields.push(`updated_at = NOW()`);
    
    // Add the ID as the last parameter
    values.push(id);
    
    if (updateFields.length === 0) {
      return this.findById(id);
    }
    
    const query = `
      UPDATE article_chunks 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING *
    `;
    
    const result = await executeQuery<PgArticleChunk>(query, values);
    return result.length > 0 ? result[0] : null;
  }
  
  // Delete a chunk
  static async delete(id: number): Promise<boolean> {
    const result = await executeQuery(
      'DELETE FROM article_chunks WHERE id = $1 RETURNING id',
      [id]
    );
    
    return result.length > 0;
  }
  
  // Perform vector search
  static async vectorSearch(embedding: number[], limit: number = 5): Promise<SearchResult[]> {
    return executeQuery<SearchResult>(
      `SELECT 
        ac.id as chunk_id,
        ac.article_id,
        ac.content,
        ac.chunk_index,
        ac.embedding <=> $1::vector AS distance,
        a.title,
        a.source,
        a.url,
        a.author,
        a.published_date
      FROM 
        article_chunks ac
      JOIN 
        articles a ON ac.article_id = a.id
      ORDER BY 
        ac.embedding <=> $1::vector
      LIMIT $2`,
      [JSON.stringify(embedding), limit]
    );
  }
  
  // Count chunks
  static async count(): Promise<number> {
    const result = await executeQuery<{ count: string }>(
      'SELECT COUNT(*) as count FROM article_chunks',
      []
    );
    
    return parseInt(result[0].count);
  }
}
