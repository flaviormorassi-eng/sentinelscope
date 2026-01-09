
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('PG Connection Error:', err);
  } else {
    console.log('PG Connection Success:', res.rows[0]);
  }
  pool.end();
});
