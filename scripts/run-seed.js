const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Conectado a la base de datos PostgreSQL.');

    let sql = fs.readFileSync(path.join(__dirname, 'seed-camp.sql'), 'utf8');
    
    // Hash real password '123456' for Sarah Connor (Camp Leader)
    const hash = await bcrypt.hash('123456', 10);
    sql = sql.replace(/'hashed_pass_mock'/g, `'${hash}'`);
    
    await client.query(sql);
    console.log('✅ Script SQL ejecutado satisfactoriamente.');

    console.log('\n--- CREDENCIALES DE PRUEBA ---');
    console.log('Usuario Líder de Campamento (Rol: camp_leader)');
    console.log('Username: sarah_connor');
    console.log('Password: 123456');
    console.log('------------------------------\n');

  } catch (error) {
    console.error('❌ Error ejecutando el script:', error.message);
  } finally {
    await client.end();
  }
}

run();
