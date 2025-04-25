import { executeQuery } from '@/lib/postgres';

export interface PgTranscription {
  id: number;
  text: string;
  created_at: Date;
  updated_at: Date;
  user_id?: string;
  user_type?: string;
  purpose?: string;
  metadata?: Record<string, any>;
}

export class TranscriptionPg {
  // Get transcription by ID
  static async findById(id: number): Promise<PgTranscription | null> {
    const transcriptions = await executeQuery<PgTranscription>(
      'SELECT * FROM transcriptions WHERE id = $1',
      [id]
    );
    
    return transcriptions.length > 0 ? transcriptions[0] : null;
  }
  
  // Get all transcriptions
  static async findAll(limit: number = 100, offset: number = 0): Promise<PgTranscription[]> {
    return executeQuery<PgTranscription>(
      'SELECT * FROM transcriptions ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
  }
  
  // Find transcriptions by user ID
  static async findByUserId(userId: string, limit: number = 10): Promise<PgTranscription[]> {
    return executeQuery<PgTranscription>(
      'SELECT * FROM transcriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
  }
  
  // Find transcriptions by user type
  static async findByUserType(userType: string, limit: number = 10): Promise<PgTranscription[]> {
    return executeQuery<PgTranscription>(
      'SELECT * FROM transcriptions WHERE user_type = $1 ORDER BY created_at DESC LIMIT $2',
      [userType, limit]
    );
  }
  
  // Find transcriptions by purpose
  static async findByPurpose(purpose: string, limit: number = 10): Promise<PgTranscription[]> {
    return executeQuery<PgTranscription>(
      'SELECT * FROM transcriptions WHERE purpose = $1 ORDER BY created_at DESC LIMIT $2',
      [purpose, limit]
    );
  }
  
  // Text search in transcriptions
  static async textSearch(query: string, limit: number = 10): Promise<PgTranscription[]> {
    return executeQuery<PgTranscription>(
      'SELECT * FROM transcriptions WHERE text ILIKE $1 ORDER BY created_at DESC LIMIT $2',
      [`%${query}%`, limit]
    );
  }
  
  // Create a new transcription
  static async create(transcription: Omit<PgTranscription, 'id' | 'created_at' | 'updated_at'>): Promise<PgTranscription> {
    const result = await executeQuery<PgTranscription>(
      `INSERT INTO transcriptions 
       (text, user_id, user_type, purpose, metadata) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [
        transcription.text,
        transcription.user_id || null,
        transcription.user_type || null,
        transcription.purpose || null,
        transcription.metadata ? JSON.stringify(transcription.metadata) : null
      ]
    );
    
    return result[0];
  }
  
  // Update a transcription
  static async update(id: number, updates: Partial<Omit<PgTranscription, 'id' | 'created_at' | 'updated_at'>>): Promise<PgTranscription | null> {
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
      UPDATE transcriptions 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING *
    `;
    
    const result = await executeQuery<PgTranscription>(query, values);
    return result.length > 0 ? result[0] : null;
  }
  
  // Delete a transcription
  static async delete(id: number): Promise<boolean> {
    const result = await executeQuery(
      'DELETE FROM transcriptions WHERE id = $1 RETURNING id',
      [id]
    );
    
    return result.length > 0;
  }
  
  // Count transcriptions
  static async count(): Promise<number> {
    const result = await executeQuery<{ count: string }>(
      'SELECT COUNT(*) as count FROM transcriptions',
      []
    );
    
    return parseInt(result[0].count);
  }
}
