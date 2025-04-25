import { executeQuery } from '@/lib/postgres';

export interface PgArticle {
  id: number;
  title: string;
  content: string;
  source: string;
  url?: string;
  author?: string;
  published_date?: Date;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
}

export class ArticlePg {
  // Get article by ID
  static async findById(id: number): Promise<PgArticle | null> {
    const articles = await executeQuery<PgArticle>(
      'SELECT * FROM articles WHERE id = $1',
      [id]
    );
    
    return articles.length > 0 ? articles[0] : null;
  }
  
  // Get all articles
  static async findAll(limit: number = 100, offset: number = 0): Promise<PgArticle[]> {
    return executeQuery<PgArticle>(
      'SELECT * FROM articles ORDER BY id LIMIT $1 OFFSET $2',
      [limit, offset]
    );
  }
  
  // Find articles by title (text search)
  static async findByTitle(title: string, limit: number = 10): Promise<PgArticle[]> {
    return executeQuery<PgArticle>(
      'SELECT * FROM articles WHERE title ILIKE $1 LIMIT $2',
      [`%${title}%`, limit]
    );
  }
  
  // Find articles by source
  static async findBySource(source: string, limit: number = 10, offset: number = 0): Promise<PgArticle[]> {
    return executeQuery<PgArticle>(
      'SELECT * FROM articles WHERE source = $1 ORDER BY id LIMIT $2 OFFSET $3',
      [source, limit, offset]
    );
  }
  
  // Count articles by source
  static async countBySource(source: string): Promise<number> {
    const result = await executeQuery<{ count: string }>(
      'SELECT COUNT(*) as count FROM articles WHERE source = $1',
      [source]
    );
    return parseInt(result[0].count);
  }
  
  // Count all articles
  static async count(): Promise<number> {
    const result = await executeQuery<{ count: string }>(
      'SELECT COUNT(*) as count FROM articles',
      []
    );
    return parseInt(result[0].count);
  }
  
  // Create a new article
  static async create(article: Omit<PgArticle, 'id' | 'created_at' | 'updated_at'>): Promise<PgArticle> {
    const result = await executeQuery<PgArticle>(
      `INSERT INTO articles 
       (title, content, source, url, author, published_date, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        article.title,
        article.content,
        article.source,
        article.url || null,
        article.author || null,
        article.published_date || null,
        article.metadata ? JSON.stringify(article.metadata) : null
      ]
    );
    
    return result[0];
  }
  
  // Update an article
  static async update(id: number, updates: Partial<Omit<PgArticle, 'id' | 'created_at' | 'updated_at'>>): Promise<PgArticle | null> {
    // Build the SET part of the query dynamically based on provided updates
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(key === 'metadata' ? JSON.stringify(value) : value);
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
      UPDATE articles 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING *
    `;
    
    const result = await executeQuery<PgArticle>(query, values);
    return result.length > 0 ? result[0] : null;
  }
  
  // Delete an article
  static async delete(id: number): Promise<boolean> {
    const result = await executeQuery(
      'DELETE FROM articles WHERE id = $1 RETURNING id',
      [id]
    );
    
    return result.length > 0;
  }
}
