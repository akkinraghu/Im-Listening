/**
 * Utility functions for validation
 */

/**
 * Checks if a string is a valid UUID
 * @param id String to validate
 * @returns boolean indicating if the string is a valid UUID
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Fallback validation for IDs that might be UUIDs or other formats
 * @param id String to validate
 * @returns boolean indicating if the string is a valid ID
 */
export function isValidID(id: string): boolean {
  // Check if it's a UUID
  if (isValidUUID(id)) {
    return true;
  }
  
  // Add other validation as needed
  // For example, check if it's a valid number or other format
  
  return id.length > 0;
}
