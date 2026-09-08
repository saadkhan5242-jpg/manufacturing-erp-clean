import { pool } from './pool.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function injectAdmin() {
  console.log("👤 Connecting via pg pool to execute structural database migrations...");
  const db = pool || global.pool;

  try {
    // 1. Read your core schema SQL file directly from your folder
    const schemaPath = path.join(__dirname, 'migrations', '001_core_schema.sql');
    const rawSqlSchema = fs.readFileSync(schemaPath, 'utf8');

    // 2. Execute the raw SQL schema to build all your tables (including users)
    console.log("  🏗️ Constructing database tables from 001_core_schema.sql...");
    await db.query(rawSqlSchema);
    console.log("  ✅ All database tables successfully constructed.");

    // 3. Prepare the administrator credentials
    const email = "admin@erp.local";
    const rawPassword = "ERPadmin2026Secure!";
    const name = "System Admin";
    const role = "admin";

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(rawPassword, saltRounds);

    // 4. Inject the root admin account into your newly created users table
    const queryText = `
      INSERT INTO users (name, email, role, password_hash, active) 
      VALUES ($1, $2, $3, $4, true) 
      ON CONFLICT (email) 
      DO UPDATE SET password_hash = $4, role = $3, name = $1;
    `;

    await db.query(queryText, [name, email, role, passwordHash]);
    console.log(`  🚀 Master administrator account successfully registered: ${email}`);
    
  } catch (err) {
    console.error("❌ Database initialization procedure crashed:", err.message);
  } finally {
    if (db && typeof db.end === 'function') {
      await db.end();
    }
    console.log("🏁 Database injection routine complete.");
  }
}

injectAdmin();
