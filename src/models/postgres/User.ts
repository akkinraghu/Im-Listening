import { executeQuery } from '@/lib/postgres';

export interface PgUser {
  id: number;
  name: string;
  email: string;
  image?: string;
  email_verified?: Date;
  created_at: Date;
  updated_at: Date;
}

export class UserPg {
  // Get user by ID
  static async findById(id: number): Promise<PgUser | null> {
    const users = await executeQuery<PgUser>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    
    return users.length > 0 ? users[0] : null;
  }
  
  // Get user by email
  static async findByEmail(email: string): Promise<PgUser | null> {
    const users = await executeQuery<PgUser>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    return users.length > 0 ? users[0] : null;
  }
  
  // Get all users
  static async findAll(limit: number = 100, offset: number = 0): Promise<PgUser[]> {
    return executeQuery<PgUser>(
      'SELECT * FROM users ORDER BY id LIMIT $1 OFFSET $2',
      [limit, offset]
    );
  }
  
  // Create a new user
  static async create(user: Omit<PgUser, 'id' | 'created_at' | 'updated_at'>): Promise<PgUser> {
    const result = await executeQuery<PgUser>(
      `INSERT INTO users 
       (name, email, image, email_verified) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [
        user.name,
        user.email,
        user.image || null,
        user.email_verified || null
      ]
    );
    
    return result[0];
  }
  
  // Update a user
  static async update(id: number, updates: Partial<Omit<PgUser, 'id' | 'created_at' | 'updated_at'>>): Promise<PgUser | null> {
    // Build the SET part of the query dynamically based on provided updates
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
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
      UPDATE users 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING *
    `;
    
    const result = await executeQuery<PgUser>(query, values);
    return result.length > 0 ? result[0] : null;
  }
  
  // Delete a user
  static async delete(id: number): Promise<boolean> {
    const result = await executeQuery(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    
    return result.length > 0;
  }
  
  // Count users
  static async count(): Promise<number> {
    const result = await executeQuery<{ count: string }>(
      'SELECT COUNT(*) as count FROM users',
      []
    );
    
    return parseInt(result[0].count);
  }
}
