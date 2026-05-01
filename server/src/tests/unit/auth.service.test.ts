/**
 * Unit Tests for Auth Service
 *
 * Tests registration validation, login credential checking, and JWT generation.
 */

import { AppError } from '../../errors/AppError';
import { RegisterSchema } from '../../schemas/auth.schemas';

// Mock the user repository before importing the service
jest.mock('../../repositories/user.repository');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

// Mock env config to avoid needing real environment variables
jest.mock('../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars',
    PORT: '3000',
    DATABASE_URL: 'postgres://localhost/test',
    CLIENT_ORIGIN: 'http://localhost:5173',
  },
}));

import * as userRepo from '../../repositories/user.repository';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as authService from '../../services/auth.service';

const mockUserRepo = userRepo as jest.Mocked<typeof userRepo>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

const mockUser = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  passwordHash: '$2b$12$hashedpassword',
  createdAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── register() ──────────────────────────────────────────────────────────────

describe('authService.register()', () => {
  it('throws AppError 409 when email is already in use', async () => {
    // Arrange: findByEmail returns an existing user
    mockUserRepo.findByEmail.mockResolvedValue(mockUser);

    // Act & Assert
    await expect(
      authService.register({
        name: 'Bob',
        email: 'alice@example.com',
        password: 'validpassword',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Email already in use',
    });

    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('alice@example.com');
    // create should never be called when email is duplicate
    expect(mockUserRepo.create).not.toHaveBeenCalled();
  });

  it('creates user and returns token + user when email is unique', async () => {
    // Arrange: no existing user, hash and create succeed, jwt signs a token
    mockUserRepo.findByEmail.mockResolvedValue(null);
    (mockBcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$newhash');
    mockUserRepo.create.mockResolvedValue({
      ...mockUser,
      name: 'Bob',
      email: 'bob@example.com',
      passwordHash: '$2b$12$newhash',
    });
    (mockJwt.sign as jest.Mock).mockReturnValue('signed.jwt.token');

    // Act
    const result = await authService.register({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'validpassword',
    });

    // Assert
    expect(result).toMatchObject({
      token: 'signed.jwt.token',
      user: {
        name: 'Bob',
        email: 'bob@example.com',
      },
    });
    expect(mockBcrypt.hash).toHaveBeenCalledWith('validpassword', 12);
    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'bob@example.com' })
    );
  });
});

// ─── RegisterSchema validation ────────────────────────────────────────────────

describe('RegisterSchema', () => {
  it('rejects a password shorter than 8 characters', () => {
    const result = RegisterSchema.safeParse({
      name: 'Test',
      email: 'test@test.com',
      password: 'short',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordError = result.error.errors.find(
        (e) => e.path.includes('password')
      );
      expect(passwordError).toBeDefined();
    }
  });

  it('accepts a password of exactly 8 characters', () => {
    const result = RegisterSchema.safeParse({
      name: 'Test',
      email: 'test@test.com',
      password: 'exactly8',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid email address', () => {
    const result = RegisterSchema.safeParse({
      name: 'Test',
      email: 'not-an-email',
      password: 'validpassword',
    });

    expect(result.success).toBe(false);
  });
});

// ─── login() ─────────────────────────────────────────────────────────────────

describe('authService.login()', () => {
  it('throws AppError 401 when user is not found', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'nobody@example.com', password: 'anypassword' })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
    });
  });

  it('throws AppError 401 when password does not match', async () => {
    // Arrange: user exists but bcrypt.compare returns false
    mockUserRepo.findByEmail.mockResolvedValue(mockUser);
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

    // Act & Assert
    await expect(
      authService.login({ email: 'alice@example.com', password: 'wrongpassword' })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
    });

    expect(mockBcrypt.compare).toHaveBeenCalledWith(
      'wrongpassword',
      mockUser.passwordHash
    );
  });

  it('returns token and user object when credentials are valid', async () => {
    // Arrange: user exists, password matches, jwt signs a token
    mockUserRepo.findByEmail.mockResolvedValue(mockUser);
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);
    (mockJwt.sign as jest.Mock).mockReturnValue('valid.jwt.token');

    // Act
    const result = await authService.login({
      email: 'alice@example.com',
      password: 'correctpassword',
    });

    // Assert
    expect(result).toMatchObject({
      token: 'valid.jwt.token',
      user: {
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
      },
    });
    expect(typeof result.token).toBe('string');
    expect(mockJwt.sign).toHaveBeenCalledWith(
      { sub: mockUser.id, email: mockUser.email },
      'test-secret-key-that-is-at-least-32-chars',
      { expiresIn: '7d' }
    );
  });

  it('throws AppError with correct type', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(mockUser);
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

    try {
      await authService.login({ email: 'alice@example.com', password: 'wrong' });
      fail('Expected an error to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
    }
  });
});
