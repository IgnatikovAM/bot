/**********************************************************************
 *  Vector-RAG память на SQLite
 *  ───────────────────────────────────────────────────────────────────
 *  Таблица `memory`:
 *    phone   TEXT    — идентификатор чата (номер телефона)
 *    text    TEXT    — оригинальное сообщение пользователя
 *    vec     BLOB    — Float32Array (эмбеддинг, 384 float × 4 байта)
 *    ts      INTEGER — timestamp
 *********************************************************************/

import path from 'path';
import fs   from 'fs';
import Database from 'better-sqlite3';
import { embed } from './EmbeddingService.js';
import { config } from '../config/index.js';

const DB_FILE = path.join(config.MEDIA_DIR, 'vector_memory.db');
if (!fs.existsSync(config.MEDIA_DIR)) fs.mkdirSync(config.MEDIA_DIR, { recursive: true });

/* ---------- открываем БД и создаём таблицу ---------------------- */
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.prepare(`
  CREATE TABLE IF NOT EXISTS memory (
    id    INTEGER PRIMARY KEY,
    phone TEXT,
    text  TEXT,
    vec   BLOB,
    ts    INTEGER
  )`).run();

/* ---------- prepared-statements -------------------------------- */
const insertStmt = db.prepare(
  `INSERT INTO memory (phone, text, vec, ts) VALUES (?, ?, ?, ?)`);

const selectByPhone = db.prepare(
  `SELECT text, vec
     FROM memory
    WHERE phone = @phone
 ORDER BY ts DESC          -- читаем свежие вектора быстрее
    LIMIT 1000`);          // safety cap: не нужно читать весь чат

/* ---------- утилиты --------------------------------------------- */
function toBlob(floatArr) {
  return Buffer.from(new Float32Array(floatArr).buffer);
}
function fromBlob(buf) {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

/* =================================================================
 *                           API
 * =================================================================*/
export async function remember(phone, text) {
  const vec = await embed(text);                // 384-мерный массив
  insertStmt.run(phone, text, toBlob(vec), Date.now());
}

export async function recall(phone, query, k = 5) {
  const rows = selectByPhone.all({ phone });
  if (!rows.length) return [];

  const qVec = await embed(query);

  const scored = rows.map(r => ({
    text: r.text,
    score: cosine(qVec, fromBlob(r.vec))
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, k)
  .filter(o => o.score > 0.25);     // минимальный порог релевантности

  return scored.map(o => o.text);
}
