/**
 * 数据库迁移：添加 users 表 + tasks.user_id 外键
 * 运行: node server/migrate.js
 */
import mysql from 'mysql2/promise';

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'energy_calendar',
};

async function migrate() {
  const pool = await mysql.createConnection(config);

  try {
    // 1. 创建 users 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        username      VARCHAR(50)  NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE INDEX idx_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ users 表已创建');

    // 2. 插入默认用户（密码 123456 的 SHA-256 哈希）
    const crypto = await import('crypto');
    const pwdHash = crypto.createHash('sha256').update('123456').digest('hex');
    await pool.query(
      'INSERT IGNORE INTO users (id, username, password_hash) VALUES (1, ?, ?)',
      ['admin', pwdHash]
    );
    console.log('✅ 默认用户 admin 已创建');

    // 3. tasks 表加 user_id 列
    const [cols] = await pool.query("SHOW COLUMNS FROM tasks LIKE 'user_id'");
    if (cols.length === 0) {
      await pool.query(
        'ALTER TABLE tasks ADD COLUMN user_id INT NOT NULL DEFAULT 1 AFTER id'
      );
      console.log('✅ tasks.user_id 列已添加');
    } else {
      console.log('⏭  tasks.user_id 列已存在，跳过');
    }

    // 4. 添加外键约束
    try {
      await pool.query(`
        ALTER TABLE tasks
        ADD CONSTRAINT fk_tasks_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
      `);
      console.log('✅ 外键 fk_tasks_user 已添加');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_FK_COLUMN_AND_DUP_KEYNAME') {
        console.log('⏭  外键已存在，跳过');
      } else {
        throw e;
      }
    }

    // 5. 给 user_id 加索引
    try {
      await pool.query('CREATE INDEX idx_tasks_user_id ON tasks(user_id)');
      console.log('✅ idx_tasks_user_id 索引已创建');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') {
        console.log('⏭  索引已存在，跳过');
      } else {
        throw e;
      }
    }

    // 6. 存量数据归到 admin
    const [r] = await pool.query('UPDATE tasks SET user_id = 1 WHERE user_id = 0 OR user_id IS NULL');
    if (r.affectedRows > 0) console.log(`✅ ${r.affectedRows} 条旧数据已关联到 admin`);

    console.log('\n🎉 迁移完成！');
  } catch (err) {
    console.error('❌ 迁移失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
