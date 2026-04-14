import mysql from 'mysql2/promise';

// Pull credentials from environment variables (loaded via --env-file flag)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true, // queue requests when all connections are busy
  connectionLimit: 10, // max simultaneous connections in the pool
  queueLimit: 0, // unlimited queuing (0 = no limit)
});

// Quick connectivity test logged at startup
pool
  .getConnection()
  .then((conn) => {
    console.log('✅  MySQL connected successfully');
    conn.release(); // always release back to the pool
  })
  .catch((err) => {
    console.error('❌  MySQL connection failed:', err.message);
  });

export default pool;
