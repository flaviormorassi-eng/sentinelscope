
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query('SELECT * FROM event_sources', (err, res) => {
  if (err) {
    console.error('Error querying event_sources:', err);
  } else {
    console.log('Found', res.rows.length, 'event sources:');
    res.rows.forEach(source => {
      console.log(source);
    });
  }
  pool.end();
});
