/**
 * Property-Based Tests for Error Handling
 *
 * Verifies that all error responses follow a consistent structured
 * envelope with a message string and an errors array.
 */

import fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../middleware/errorHandler';
import { AppError } from '../../errors/AppError';

/**
 * Creates a fresh mock response object for each test run.
 * The mock captures calls to `status()` and `json()` so we can assert
 * the structured error envelope is always present.
 */
function createMockRes() {
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return mockRes as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
}

const mockReq = {} as Request;
const mockNext = jest.fn() as unknown as NextFunction;

describe('Error Handler Properties', () => {
  /**
   * Property 10: Structured error envelope is always present on errors
   *
   * For any request that results in an HTTP 4xx or 5xx response, the response
   * body SHALL be a JSON object containing at minimum a non-empty `message`
   * string and an `errors` array.
   *
   * Validates: Requirements 12.1, 12.2
   */
  describe('Property 10: Structured error envelope is always present on errors', () => {
    it(
      'AppError with arbitrary status codes and messages — response must always contain message (string) and errors (array)',
      () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 400, max: 599 }),
            fc.string({ minLength: 1 }),
            (statusCode, message) => {
              const mockRes = createMockRes();
              const error = new AppError(statusCode, message);

              errorHandler(error, mockReq, mockRes, mockNext);

              // res.status must be called with the AppError's statusCode
              expect(mockRes.status).toHaveBeenCalledWith(statusCode);

              // res.json must be called exactly once
              expect(mockRes.json).toHaveBeenCalledTimes(1);

              const body = mockRes.json.mock.calls[0][0];

              // The envelope must contain a non-empty message string
              expect(typeof body.message).toBe('string');
              expect(body.message.length).toBeGreaterThan(0);

              // The envelope must contain an errors array
              expect(Array.isArray(body.errors)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      }
    );

    it(
      'Unexpected errors — response must always be 500 with message (string) and errors (empty array)',
      () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1 }),
            (message) => {
              const mockRes = createMockRes();
              const error = new Error(message);

              errorHandler(error, mockReq, mockRes, mockNext);

              // Unexpected errors must always result in HTTP 500
              expect(mockRes.status).toHaveBeenCalledWith(500);

              // res.json must be called exactly once
              expect(mockRes.json).toHaveBeenCalledTimes(1);

              const body = mockRes.json.mock.calls[0][0];

              // The envelope must contain a non-empty message string
              expect(typeof body.message).toBe('string');
              expect(body.message.length).toBeGreaterThan(0);

              // Unexpected errors must have an empty errors array
              expect(Array.isArray(body.errors)).toBe(true);
              expect(body.errors).toEqual([]);
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  });
});
