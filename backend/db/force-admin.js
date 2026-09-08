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
    // 1. Read and execute the core schema SQL file to make sure tables exist
    const schemaPath = path.join(__dirname, 'migrations', '001_core_schema.sql');
    const rawSqlSchema = fs.readFileSync(schemaPath, 'utf8');
    await db.query(rawSqlSchema);
    console.log("  ✅ All database tables verified/constructed.");

    // 2. SEED THE ROLES TABLE FIRST (Crucial step!)
    console.log("  🔑 Seeding system access roles...");
    await db.query(`
      INSERT INTO roles (name, permissions)
      VALUES ('admin', '{"all": true}'::jsonb), ('viewer', '{"read": true}'::jsonb)
      ON CONFLICT (name) DO NOTHING;
    `);
    
    // Fetch the ID of the admin role we just verified
    const roleRes = await db.query("SELECT id FROM roles WHERE name = 'admin' LIMIT 1;");
    const adminRoleId = roleRes.rows[0]?.id || null;

    // 3. Prepare the administrator credentials
    const email = "admin@erp.local";
    const rawPassword = "ERPadmin2026Secure!";
    const name = "System Admin";
    const roleText = "admin";

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(rawPassword, saltRounds);

    // 4. Inject the root admin account with its correct role mapping ID
    const queryText = `
      INSERT INTO users (name, email, role, role_id, password_hash, active) 
      VALUES ($1, $2, $3, $4, $5, true) 
      ON CONFLICT (email) 
      DO UPDATE SET password_hash = $5, role = $3, role_id = $4, name = $1;
    `;

    await db.query(queryText, [name, email, roleText, adminRoleId, passwordHash]);
    console.log(`  🚀 Master administrator account successfully registered with role ID: ${adminRoleId}`);
    
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
