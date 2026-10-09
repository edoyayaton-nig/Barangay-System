import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Helper to sanitize and extract credentials from any connection URL
export function parseDatabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    let fixedUrl = rawUrl.trim();
    // Auto-repair URLs missing username before colon: mysql://:password@host:port/dbname
    if (fixedUrl.startsWith('mysql://:')) {
      const defaultUser = process.env.MYSQLUSER || process.env.MYSQL_USER || process.env.DB_USER || 'root';
      fixedUrl = fixedUrl.replace('mysql://:', `mysql://${defaultUser}:`);
    }
    const parsed = new URL(fixedUrl);
    const dbName = parsed.pathname ? parsed.pathname.replace(/^\//, '').split('?')[0] : undefined;
    return {
      host: parsed.hostname || undefined,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      database: dbName || undefined
    };
  } catch (err) {
    console.warn('⚠️ [Database URL Parse Warning]:', err.message);
    return null;
  }
}

// Check all common Railway / Cloud connection URL variables
const rawConnUrl = process.env.MYSQL_URL ||
  process.env.MYSQL_PRIVATE_URL ||
  process.env.DATABASE_URL ||
  process.env.DATABASE_PRIVATE_URL ||
  process.env.MYSQL_PUBLIC_URL ||
  process.env.DATABASE_PUBLIC_URL;

const parsedUrlConfig = parseDatabaseUrl(rawConnUrl);

// Resolve individual credentials with exhaustive fallback coverage for Railway & cloud
const resolvedHost = process.env.MYSQLHOST ||
  process.env.MYSQL_HOST ||
  process.env.DB_HOST ||
  process.env.DATABASE_HOST ||
  parsedUrlConfig?.host ||
  'localhost';

const resolvedPort = Number(
  process.env.MYSQLPORT ||
  process.env.MYSQL_PORT ||
  process.env.DB_PORT ||
  process.env.DATABASE_PORT ||
  parsedUrlConfig?.port
) || 3306;

const resolvedUser = process.env.MYSQLUSER ||
  process.env.MYSQL_USER ||
  process.env.DB_USER ||
  process.env.DATABASE_USER ||
  parsedUrlConfig?.user ||
  'root';

const resolvedPassword = process.env.MYSQLPASSWORD ||
  process.env.MYSQL_PASSWORD ||
  process.env.DB_PASSWORD ||
  process.env.DATABASE_PASSWORD ||
  process.env.MYSQL_ROOT_PASSWORD ||
  process.env.DB_PASS ||
  parsedUrlConfig?.password ||
  '';

const resolvedDatabase = process.env.MYSQLDATABASE ||
  process.env.MYSQL_DATABASE ||
  process.env.DB_NAME ||
  process.env.DATABASE_NAME ||
  parsedUrlConfig?.database ||
  (process.env.MYSQLHOST || process.env.MYSQL_HOST ? 'railway' : 'smart_db');

if (!resolvedPassword && resolvedHost !== 'localhost' && resolvedHost !== '127.0.0.1' && resolvedHost !== '::1') {
  console.warn(`⚠️ [MySQL Notice] Connecting to remote host '${resolvedHost}' with an empty password. If deploying on Railway, ensure MYSQLPASSWORD=\${{MySQL.MYSQLPASSWORD}} is set in service variables.`);
}

export const dbConfig = {
  host: resolvedHost,
  user: resolvedUser,
  password: resolvedPassword,
  database: resolvedDatabase,
  port: resolvedPort,
  waitForConnections: true,
  connectionLimit: 25,
  queueLimit: 0,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

let pool = null;
let isConnected = false;
let connectionError = null;

try {
  pool = mysql.createPool(dbConfig);
} catch (err) {
  console.warn('⚠️ [MySQL] Pool creation warning:', err.message);
  connectionError = err.message;
}

export async function testConnection() {
  if (!pool) return { connected: false, error: connectionError || 'MySQL pool not initialized' };
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    isConnected = true;
    connectionError = null;
    return { connected: true, host: dbConfig.host, database: dbConfig.database, port: dbConfig.port };
  } catch (err) {
    isConnected = false;
    connectionError = err.message;
    return {
      connected: false,
      error: err.message,
      host: dbConfig.host,
      database: dbConfig.database,
      port: dbConfig.port,
      help: 'Ensure MySQL server (e.g. XAMPP / Railway / Docker) is running with valid credentials and schema.sql has been executed.'
    };
  }
}

export function getPool() {
  return pool;
}

export function getStatus() {
  return {
    connected: isConnected,
    error: connectionError,
    config: {
      host: dbConfig.host,
      database: dbConfig.database,
      port: dbConfig.port,
      user: dbConfig.user
    }
  };
}
