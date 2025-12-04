const { Pool } = require('pg');

// 从环境变量获取数据库连接信息
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 创建数据表（如果不存在）
const initTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_tweets (
        date VARCHAR(10) PRIMARY KEY,
        urls JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table initialized successfully');
  } catch (error) {
    console.error('Error initializing table:', error);
  }
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  // 初始化表
  await initTable();

  let body = '';
  await new Promise(resolve => {
    req.on('data', c => body += c);
    req.on('end', resolve);
  });

  let payload = {};
  try {
    payload = JSON.parse(body || '{}');
  } catch (e) {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  const date = payload.date || '';
  const urls = payload.urls || [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(urls)) {
    res.status(400).json({ error: 'bad_request' });
    return;
  }

  try {
    // 使用 UPSERT 语法（ON CONFLICT）来插入或更新数据
    const result = await pool.query(
      `INSERT INTO daily_tweets (date, urls) 
       VALUES ($1, $2) 
       ON CONFLICT (date) 
       DO UPDATE SET urls = $2, created_at = CURRENT_TIMESTAMP`,
      [date, JSON.stringify(urls)]
    );

    console.log(`Successfully saved ${urls.length} URLs for date ${date}`);
    res.json({ ok: true });
  } catch (error) {
    console.error('Database save error:', error);
    res.status(500).json({ error: 'database_error', details: error.message });
  }
};