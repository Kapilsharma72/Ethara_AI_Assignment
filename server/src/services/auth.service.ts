import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as userRepo from '../repositories/user.repository';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';

export interface AuthResult {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'member';
  };
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'member';
}): Promise<AuthResult> {
  const existing = await userRepo.findByEmail(data.email);
  if (existing) {
    throw new AppError(409, 'Email already in use');
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await userRepo.create({
    name: data.name,
    email: data.email,
    passwordHash,
    role: data.role,
  });

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const user = await userRepo.findByEmail(data.email);
  if (!user) {
    throw new AppError(401, 'Invalid credentials');
  }

  const passwordMatch = await bcrypt.compare(data.password, user.passwordHash);
  if (!passwordMatch) {
    throw new AppError(401, 'Invalid credentials');
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}
