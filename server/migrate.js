import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dbConfig } from './config/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigration() {
  const { host, port, user, password, database: dbName } = dbConfig;

  console.log(`⏳ Connecting to MySQL server at ${host}:${port} as user '${user}'...`);

  let connection;
  try {
    // 1. Connect: First try connecting without selecting a database so we can CREATE DATABASE IF NOT EXISTS
    try {
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
    } catch (rootConnErr) {
      // If connecting without selecting database is denied (common in managed/cloud MySQL where user only has direct access to dbName)
      console.log(`ℹ️ Attempting direct connection to database '${dbName}'...`);
      connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database: dbName,
        multipleStatements: true
      });
      console.log(`✅ Connected directly to database '${dbName}'.`);
    }

    // 3. Read and execute schema.sql
    const schemaPath = path.resolve(__dirname, '../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log(`📄 Executing schema.sql DDL migrations...`);
      let schemaSql = fs.readFileSync(schemaPath, 'utf8');
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

    console.log(`🎉 [Migration Complete] Database '${dbName}' is fully populated and ready on ${host}:${port}!`);
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
