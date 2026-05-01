/**
 * Property-Based Tests for Project Validation
 *
 * Covers: project name validation, membership-scoped visibility,
 * and member removal access revocation.
 */

import fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';
import { CreateProjectSchema } from '../../schemas/project.schemas';
import { AppError } from '../../errors/AppError';
import { requireRole } from '../../middleware/requireRole';

// Mock the pg pool so no real DB connection is needed
jest.mock('../../db/pool');

describe('Project Properties', () => {
  /**
   * Property 3: Whitespace-only project names are rejected
   *
   * For any string composed entirely of whitespace characters (spaces, tabs,
   * newlines, carriage returns), submitting it as a project name SHALL be
   * rejected by the schema validation.
   *
   * The CreateProjectSchema uses `.trim().min(1)` which trims whitespace before
   * checking the minimum length, so any whitespace-only string becomes empty
   * after trimming and fails the min(1) constraint.
   *
   * Validates: Requirements 3.2
   */
  describe('Property 3: Whitespace-only project names are rejected', () => {
    it(
      'should reject any whitespace-only string as a project name — safeParse must fail with a name field error',
      () => {
        fc.assert(
          fc.property(
            fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1 }),
            (whitespaceString) => {
              const result = CreateProjectSchema.safeParse({ name: whitespaceString });

              // The schema must reject whitespace-only names
              expect(result.success).toBe(false);

              if (!result.success) {
                // There must be at least one field error for 'name'
                const nameErrors = result.error.errors.filter(
                  (e) => e.path.length > 0 && e.path[0] === 'name'
                );
                expect(nameErrors.length).toBeGreaterThan(0);
              }
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  });

  /**
   * Property 4: Project membership scopes visibility
   *
   * For any user U and project P where U is not a member of P, every API
   * endpoint that operates on P SHALL return HTTP 403 for requests made by U.
   *
   * This test exercises the `requireRole` middleware directly (unit test, no
   * HTTP server needed). The pg pool is mocked to return 0 rows, simulating a
   * user who is not a member of the project.
   *
   * Validates: Requirements 5.1, 5.3, 10.5, 11.4
   */
  describe('Property 4: Project membership scopes visibility', () => {
    // Retrieve the mocked pool after jest.mock has been applied
    let mockPool: { query: jest.Mock };

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      mockPool = require('../../db/pool').default;
      jest.clearAllMocks();
    });

    it(
      'should call next with AppError(403) for any non-member user/project pair',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 1_000_000 }),
            fc.integer({ min: 1, max: 1_000_000 }),
            async (projectId, userId) => {
              // Simulate pool.query returning 0 rows (user is not a member)
              mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

              const req = {
                user: { id: userId, email: 'test@test.com' },
                params: { projectId: String(projectId) },
              } as unknown as Request;

              const res = {} as Response;

              let capturedError: unknown;
              const next: NextFunction = (err?: unknown) => {
                capturedError = err;
              };

              await requireRole('member')(req, res, next);

              // next must have been called with an AppError whose statusCode is 403
              expect(capturedError).toBeInstanceOf(AppError);
              expect((capturedError as AppError).statusCode).toBe(403);
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  });

  /**
   * Property 9: Member removal revokes project access
   *
   * For any user U who was a member of project P, after an admin removes U
   * from P, every subsequent request by U to any endpoint scoped to P SHALL
   * return HTTP 403.
   *
   * This test exercises the `requireRole` middleware directly (unit test, no
   * HTTP server needed). The pg pool is mocked to return 0 rows, simulating
   * the post-removal state where the user no longer appears in project_members.
   *
   * Validates: Requirements 4.4, 5.3
   */
  describe('Property 9: Member removal revokes project access', () => {
    let mockPool: { query: jest.Mock };

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      mockPool = require('../../db/pool').default;
      jest.clearAllMocks();
    });

    it(
      'should call next with AppError(403) for any removed member user/project pair',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 1_000_000 }),
            fc.integer({ min: 1, max: 1_000_000 }),
            async (projectId, userId) => {
              // Simulate the post-removal state: pool.query returns 0 rows
              // because the user has been removed from project_members
              mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

              const req = {
                user: { id: userId, email: 'removed@test.com' },
                params: { projectId: String(projectId) },
              } as unknown as Request;

              const res = {} as Response;

              let capturedError: unknown;
              const next: NextFunction = (err?: unknown) => {
                capturedError = err;
              };

              await requireRole('member')(req, res, next);

              // After removal, requireRole must forward an AppError(403)
              expect(capturedError).toBeInstanceOf(AppError);
              expect((capturedError as AppError).statusCode).toBe(403);
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  });
});
