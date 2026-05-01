import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  DATABASE_URL:  z.string().url(),
  JWT_SECRET:    z.string().min(32),
  PORT:          z.string().default('3000'),
  CLIENT_ORIGIN: z.string().url(),
});

let env: z.infer<typeof EnvSchema>;

try {
  env = EnvSchema.parse(process.env);
} catch (err) {
  console.error('❌ Invalid environment variables:', err instanceof Error ? err.message : err);
  process.exit(1);
}

export { env };
