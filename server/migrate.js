import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigration() {
  const host = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
  const port = Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306;
  const user = process.env.DB_USER || process.env.MYSQLUSER || 'root';
  const password = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || '';
  const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'smart_db';

  console.log(`⏳ Connecting to MySQL server at ${host}:${port} as user '${user}'...`);

  let connection;
  try {
    // 1. Connect without selecting a database first
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });

    console.log(`✅ Connected to MySQL server.`);

    // 2. Create Database if not exists
    try {
      console.log(`📦 Creating database '${dbName}' if not exists...`);
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    } catch (dbErr) {
      console.log(`ℹ️ [Database Notice] Using existing database '${dbName}': ${dbErr.message}`);
    }
    await connection.query(`USE \`${dbName}\`;`);
    console.log(`✅ Database '${dbName}' selected.`);

    // 3. Read and execute schema.sql
    const schemaPath = path.resolve(__dirname, '../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log(`📄 Executing schema.sql DDL migrations...`);
      let schemaSql = fs.readFileSync(schemaPath, 'utf8');
      // Strip any hardcoded USE statement so it targets the configured DB_NAME
      schemaSql = schemaSql.replace(/CREATE DATABASE IF NOT EXISTS `[^`]+`;/gi, '');
      schemaSql = schemaSql.replace(/USE `[^`]+`;/gi, '');
      await connection.query(schemaSql);
      console.log(`✅ Schema tables created successfully.`);
    }

    // 4. Read and execute seed.sql
    const seedPath = path.resolve(__dirname, '../database/seed.sql');
    if (fs.existsSync(seedPath)) {
      console.log(`🌱 Executing seed.sql data insertion...`);
      let seedSql = fs.readFileSync(seedPath, 'utf8');
      seedSql = seedSql.replace(/USE `[^`]+`;/gi, '');
      await connection.query(seedSql);
      console.log(`✅ Seed data inserted successfully.`);
    }

    console.log(`🎉 [Migration Complete] Database '${dbName}' is fully populated and ready on localhost:${port}!`);
    return { success: true, database: dbName };
  } catch (err) {
    console.error(`❌ [Migration Error] ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Execute directly if run via `node server/migrate.js`
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigration();
}
