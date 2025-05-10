import { pool } from './pool.js';

export async function runMigrations () {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contact VARCHAR(50) UNIQUE,
      style VARCHAR(50) DEFAULT 'INFORMAL',
      mood VARCHAR(50) DEFAULT 'нейтральный',
      auto_style BOOLEAN DEFAULT true,
      tts_enabled BOOLEAN DEFAULT false,
      tts_voice VARCHAR(50) DEFAULT 'alena'
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chat VARCHAR(50),
      type VARCHAR(50),
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
}
