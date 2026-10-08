require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const createMembersRouter = require('./routes/members');
const createPurchasesRouter = require('./routes/purchases');
const createCoffeesRouter = require('./routes/coffees');
const path = require('path');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = process.env.DATABASE_URL || process.env.MYSQL_URL
  ? (process.env.DATABASE_URL || process.env.MYSQL_URL)
  : {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'lap6',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'lap_6',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  };

const db = mysql.createPool(dbConfig);

app.use('/api/members', (req, res, next) => {
  req.db = db;
  next();
}, createMembersRouter);
app.use('/api/purchases', (req, res, next) => {
  req.db = db;
  next();
}, createPurchasesRouter);
app.use('/api/coffees', (req, res, next) => {
  req.db = db;
  next();
}, createCoffeesRouter);

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Database connection failed:', error.message);
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

async function start() {
  try {
    await db.query('SELECT 1');
    console.log('Connected to MySQL database.');

    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Unable to connect to MySQL:', {
      message: error.message || '(no message)',
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port,
      host: process.env.DB_HOST || '(connection URL)',
      database: process.env.DB_NAME || '(from connection URL)',
    });
    process.exit(1);
  }
}

start();
