const db = require('./src/db');
db.raw('select 1 as ok')
  .then(r => { console.log('DB connected', r[0]); process.exit(0); })
  .catch(e => { console.error('DB failed:', e.message); process.exit(1); });