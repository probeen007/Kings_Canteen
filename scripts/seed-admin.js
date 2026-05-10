const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { Client } = require('pg');

// Load .env.local manually if env vars are missing (node doesn't auto-load Next.js env files)
if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        // remove surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch (e) {
    // ignore; we'll fail later with a clear message
  }
}

async function seed() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DIRECT_URL or DATABASE_URL');
  }

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@canteen.local';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  const phone = process.env.SEED_ADMIN_PHONE || '+9779800000000';
  const passwordHash = await bcrypt.hash(password, 12);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM "User" WHERE email = $1 LIMIT 1', [email]);
    if (existing.rowCount > 0) {
      await client.query('COMMIT');
      console.log('Admin user already exists:', email);
      return;
    }

    const userId = randomUUID();
    await client.query(
      `INSERT INTO "User" (id, email, phone, name, "passwordHash", role, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'ADMIN', true, now(), now())`,
      [userId, email, phone, 'Administrator', passwordHash]
    );

    await client.query(
      `INSERT INTO "AuditLog" (id, "userId", action, "createdAt")
       VALUES ($1, $2, 'ADMIN_SEEDED', now())`,
      [randomUUID(), userId]
    );

    await client.query('COMMIT');
    console.log('Created admin user:', email);
    console.log('Password (keep secret):', password);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
