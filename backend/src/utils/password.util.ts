import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const HASH_BYTES = 64;

export function createUserPasswordHash(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const hash = scryptSync(password, salt, HASH_BYTES).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyUserPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const [salt, expectedHashHex] = parts;
  const expectedHash = Buffer.from(expectedHashHex, 'hex');
  const providedHash = scryptSync(password, salt, HASH_BYTES);

  if (expectedHash.length !== providedHash.length) {
    return false;
  }

  return timingSafeEqual(expectedHash, providedHash);
}