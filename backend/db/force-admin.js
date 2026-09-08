import pool from './pool.js';
import bcrypt from 'bcrypt'; // Using the standard package your backend uses to check passwords

async function injectAdmin() {
  console.log("👤 Connecting via pg pool to inject master administrator profile...");
  
  const email = "admin@erp.local";
  const rawPassword = "ERPadmin2026Secure!";
  const name = "System Admin";
  const role = "admin"; // Lowcase matching your schema defaults

  try {
    // Generate the exact bcrypt hash salt your backend logic expects
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(rawPassword, saltRounds);

    // SQL query matching your precise 001_core_schema.sql columns exactly
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
