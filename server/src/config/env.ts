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
  console.error('');
  console.error('❌ SERVER STARTUP FAILED — Missing or invalid environment variables');
  console.error('');
  console.error('Required variables:');
  console.error('  DATABASE_URL   — PostgreSQL connection string');
  console.error('  JWT_SECRET     — Random string, minimum 32 characters');
  console.error('  CLIENT_ORIGIN  — Frontend URL (e.g. https://your-app.railway.app)');
  console.error('');
  console.error('In Railway: go to your service → Variables tab and add these.');
  console.error('');
  if (err instanceof Error) console.error('Detail:', err.message);
  process.exit(1);
}

export { env };
