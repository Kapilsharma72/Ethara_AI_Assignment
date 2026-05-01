import * as fs from 'fs';
import * as path from 'path';
import pool from './pool';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  try {
    // 1. Create schema_migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 2. Read all .sql files from the migrations directory in numeric order
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // lexicographic sort preserves numeric order (001_, 002_, ...)

    // 3. Apply each migration that hasn't been applied yet
    for (const filename of files) {
      // Check if this migration has already been applied
      const result = await client.query(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [filename]
      );

      if (result.rowCount && result.rowCount > 0) {
        console.log(`[migrate] Already applied: ${filename}`);
        continue;
      }

      // 4. Read the SQL file and execute it in a transaction
      console.log(`[migrate] Applying: ${filename}`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        // 5. Record the migration as applied
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`[migrate] Applied:  ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('[migrate] All migrations complete.');
  } finally {
    client.release();
  }
}

// 8. Main execution block — runnable directly with ts-node
runMigrations()
  .catch((err) => {
    console.error('[migrate] Migration failed:', err);
    process.exit(1);
  })
  .finally(() => {
    // 7. Close the pool connection when done
    pool.end();
  });
