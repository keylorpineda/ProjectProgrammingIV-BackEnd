const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();
  const res = await client.query("SELECT id, username, email, status FROM user_account WHERE username = 'sarah_connor'");
  console.log('Sarah:', res.rows);
  await client.end();
}

check().catch(console.error);
