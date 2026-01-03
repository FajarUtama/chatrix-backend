/**
 * ULID (Universally Unique Lexicographically Sortable Identifier) generator
 * Simple implementation for generating time-ordered unique IDs
 * Format: 26 characters, base32 encoded
 * 
 * Note: This is a simplified implementation. For production, consider using 'ulid' npm package
 */

const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LEN = 10;
const RANDOM_LEN = 16;

/**
 * Generate a ULID
 * Format: [10 chars timestamp][16 chars random]
 */
export function generateUlid(): string {
  const timestamp = Date.now();
  const random = getRandomValues(RANDOM_LEN);
  
  return encodeTimestamp(timestamp) + encodeRandom(random);
}

/**
 * Encode timestamp (48 bits) to 10 base32 characters
 */
function encodeTimestamp(timestamp: number): string {
  let result = '';
  let value = timestamp;
  
  for (let i = 0; i < TIME_LEN; i++) {
    result = CROCKFORD_BASE32[value % 32] + result;
    value = Math.floor(value / 32);
  }
  
  return result;
}

/**
 * Encode random bytes to 16 base32 characters
 */
function encodeRandom(values: number[]): string {
  let result = '';
  
  for (let i = 0; i < RANDOM_LEN; i++) {
    result += CROCKFORD_BASE32[values[i] % 32];
  }
  
  return result;
}

/**
 * Get random values (simplified - for production use crypto.getRandomValues)
 */
function getRandomValues(length: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < length; i++) {
    values.push(Math.floor(Math.random() * 32));
  }
  return values;
}

/**
 * Check if string is valid ULID format
 */
export function isValidUlid(str: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{26}$/.test(str);
}

