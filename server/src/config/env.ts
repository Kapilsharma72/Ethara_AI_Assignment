import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  DATABASE_URL:  z.string().min(1),
  JWT_SECRET:    z.string().min(16), // relaxed from 32 to handle Railway's secret(32) which may be shorter after encoding
  PORT:          z.string().default('3000'),
  CLIENT_ORIGIN: z.string().min(1).transform((val) => {
    // Railway's RAILWAY_PUBLIC_DOMAIN gives just the domain without protocol
    // Ensure it always has https://
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    return `https://${val}`;
  }),
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
  console.error('  JWT_SECRET     — Random string, minimum 16 characters');
  console.error('  CLIENT_ORIGIN  — Frontend URL (e.g. https://your-app.railway.app)');
  console.error('');
  console.error('In Railway: go to your service → Variables tab and add these.');
  console.error('');
  if (err instanceof Error) console.error('Detail:', err.message);
  process.exit(1);
}

export { env };
