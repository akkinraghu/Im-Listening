/**
 * Utility functions for text processing
 */

/**
 * Splits a text into chunks of specified size with optional overlap
 * @param text The text to split into chunks
 * @param chunkSize The maximum size of each chunk
 * @param overlapSize The number of characters to overlap between chunks
 * @returns Array of text chunks
 */
export function generateChunks(text: string, chunkSize: number = 1000, overlapSize: number = 200): string[] {
  if (!text) return [];
  
  const chunks: string[] = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    // Calculate end index for this chunk
    let endIndex = startIndex + chunkSize;
    
    // If we're not at the end of the text, try to find a good break point
    if (endIndex < text.length) {
      // Look for a period, question mark, or exclamation mark followed by a space or newline
      const breakPoint = text.substring(endIndex - 50, endIndex + 50).search(/[.!?]\s/);
      
      if (breakPoint !== -1) {
        endIndex = endIndex - 50 + breakPoint + 2; // +2 to include the punctuation and space
      } else {
        // If no good break point, look for a space
        const spaceIndex = text.indexOf(' ', endIndex);
        if (spaceIndex !== -1 && spaceIndex < endIndex + 50) {
          endIndex = spaceIndex + 1;
        }
      }
    } else {
      endIndex = text.length;
    }
    
    // Add this chunk to our array
    chunks.push(text.substring(startIndex, endIndex).trim());
    
    // Move the start index for the next chunk, accounting for overlap
    startIndex = endIndex - overlapSize;
    
    // Make sure we're making progress
    if (startIndex <= 0 || endIndex >= text.length) {
      break;
    }
  }
  
  return chunks;
}
