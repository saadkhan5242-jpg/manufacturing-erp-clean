import pool from './pool.js';

async function injectAdmin() {
  console.log("👤 Connecting via pg pool to inject master administrator profile...");
  
  const email = process.env.ERP_ADMIN_EMAIL || "admin@erp.local";
  const password = process.env.ERP_ADMIN_PASSWORD || "ERPadmin2026Secure!";
  const name = "System Admin";
  const role = "ADMIN";

  try {
    // 1. Try a standard users table insert statement
    await pool.query(`
      INSERT INTO users (email, password, name, role) 
      VALUES ($1, $2, $3, $4) 
      ON CONFLICT (email) DO UPDATE SET password = $2;
    `, [email, password, name, role]);
    
    console.log(`  ✅ Root administrator successfully updated for: ${email}`);
  } catch (err) {
    console.log("  ⚠️ Column check variant required, testing standard fallbacks...");
    try {
      // 2. Fallback if your core schema uses "username" instead of "name"
      await pool.query(`
        INSERT INTO users (email, password, username, role) 
        VALUES ($1, $2, $3, $4) 
        ON CONFLICT (email) DO UPDATE SET password = $2;
      `, [email, password, name, role]);
      console.log(`  ✅ Root administrator successfully fallback updated for: ${email}`);
    } catch (fallbackErr) {
      console.error("❌ Direct seed insertion blocked:", fallbackErr.message);
    }
  } finally {
    await pool.end();
    console.log("🏁 Database injection routine complete.");
  }
}

injectAdmin();
