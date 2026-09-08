import pool from './pool.js';
import bcrypt from 'bcryptjs'; // Changed to match your project's native library format

async function injectAdmin() {
  console.log("👤 Connecting via pg pool to inject master administrator profile...");
  
  const email = "admin@erp.local";
  const rawPassword = "ERPadmin2026Secure!";
  const name = "System Admin";
  const role = "admin";

  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(rawPassword, saltRounds);

    const queryText = `
      INSERT INTO users (name, email, role, password_hash, active) 
      VALUES ($1, $2, $3, $4, true) 
      ON CONFLICT (email) 
      DO UPDATE SET password_hash = $4, role = $3, name = $1;
    `;

    await pool.query(queryText, [name, email, role, passwordHash]);
    console.log(`  ✅ Root administrator account successfully established/reset for: ${email}`);
    
  } catch (err) {
    console.error("❌ Direct seed insertion failed:", err.message);
  } finally {
    await pool.end();
    console.log("🏁 Database injection routine complete.");
  }
}

injectAdmin();
