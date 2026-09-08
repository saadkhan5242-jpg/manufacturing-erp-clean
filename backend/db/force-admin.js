import { pool } from './pool.js'; // Destructured named connector matching your export syntax exactly
import bcrypt from 'bcryptjs';

async function injectAdmin() {
  console.log("👤 Connecting via pg pool to inject master administrator profile...");
  
  const email = "admin@erp.local";
  const rawPassword = "ERPadmin2026Secure!";
  const name = "System Admin";
  const role = "admin";

  // Use the active configuration parameter or fallback to local connector definitions smoothly
  const db = pool || global.pool;

  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(rawPassword, saltRounds);

    const queryText = `
      INSERT INTO users (name, email, role, password_hash, active) 
      VALUES ($1, $2, $3, $4, true) 
      ON CONFLICT (email) 
      DO UPDATE SET password_hash = $4, role = $3, name = $1;
    `;

    await db.query(queryText, [name, email, role, passwordHash]);
    console.log(`  ✅ Root administrator account successfully established/reset for: ${email}`);
    
  } catch (err) {
    console.error("❌ Direct seed insertion failed:", err.message);
  } finally {
    if (db && typeof db.end === 'function') {
      await db.end();
    }
    console.log("🏁 Database injection routine complete.");
  }
}

injectAdmin();
