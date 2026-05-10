const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// Load .env.local manually
if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch (e) {
    // ignore
  }
}

async function checkAdmin() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('Missing DB URL');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const result = await client.query('SELECT id, email, "passwordHash", role, "isActive" FROM "User" WHERE email = $1', ['admin@canteen.local']);
    
    if (result.rowCount === 0) {
      console.log('❌ Admin user NOT found');
      return;
    }

    const user = result.rows[0];
    console.log('✅ Admin user found:');
    console.log('  Email: ' + user.email);
    console.log('  Role: ' + user.role);
    console.log('  Active: ' + user.isActive);

    const testPassword = 'Admin123!';
    const matches = await bcrypt.compare(testPassword, user.passwordHash);
    console.log('  Password matches Admin123!: ' + matches);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkAdmin();
