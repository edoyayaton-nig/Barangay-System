import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'smart_db',
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
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
      help: 'Ensure MySQL server (e.g. XAMPP / WAMP / Docker) is running on port 3306 and schema.sql has been executed.'
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
