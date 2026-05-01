/**
 * Property-Based Tests for Authentication
 *
 * Tests that password storage never exposes plaintext and
 * that JWT tokens correctly preserve user identity through sign/verify.
 */

import fc from 'fast-check';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Auth Properties', () => {
  describe('Property 1: Password storage never exposes plaintext', () => {
    it(
      'should never store a password as plaintext — hash must differ from original and bcrypt.compare must return true',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 8 }),
            async (password) => {
              const hash = await bcrypt.hash(password, 12);

              // The stored hash must never equal the plaintext password
              expect(hash).not.toBe(password);

              // bcrypt.compare must confirm the password matches the hash
              const matches = await bcrypt.compare(password, hash);
              expect(matches).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      },
      // bcrypt with cost 12 is slow; allow enough time for 100 runs
      120_000
    );
  });

  /**
   * Property 2: JWT round-trip preserves user identity
   *
   * For any registered user, signing a JWT with their ID and then verifying
   * that token SHALL yield the same user ID and email that were embedded.
   *
   * Validates: Requirements 1.1, 2.1
   */
  describe('Property 2: JWT round-trip preserves user identity', () => {
    it(
      'should preserve user identity through JWT sign/verify round-trip — decoded sub and email must match inputs',
      () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 1, max: 1_000_000 }),
            fc.emailAddress(),
            (id, email) => {
              const token = jwt.sign(
                { sub: id, email },
                'test-secret-key-that-is-at-least-32-chars',
                { expiresIn: '1h' }
              );

              const decoded = jwt.verify(
                token,
                'test-secret-key-that-is-at-least-32-chars'
              ) as jwt.JwtPayload;

              // The decoded subject must equal the original user ID
              expect(decoded.sub).toBe(id);

              // The decoded email must equal the original email
              expect(decoded.email).toBe(email);
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  });
});
