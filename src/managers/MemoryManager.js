import { pool } from '../db/pool.js';

/**
 * Простая долговременная память на FULLTEXT-поиске.
 * Мы по-прежнему можем ей пользоваться параллельно с векторной,
 * либо можно оставить только для резервного «fallback».
 */
export class MemoryManager {

  /** сохраняем текст, если он длиннее 20 символов */
  static async save (chatId, content) {
    if (!content || content.length < 20) return;
    await pool.query(
      'INSERT INTO long_memory (chat_id, content) VALUES (?, ?)',
      [chatId, content]
    );
  }

  /**
   * Возвращаем top-N сообщений, релевантных запросу (FULLTEXT MATCH…AGAINST)
   * @param {number} chatId
   * @param {string} query
   * @param {number} limit
   * @returns {Array<{content:string, score:number}>}
   */
  static async recall (chatId, query, limit = 3) {
    if (!query || query.length < 8) return [];

    const [rows] = await pool.query(
      `SELECT content,
              MATCH(content) AGAINST (?) AS score
       FROM long_memory
       WHERE chat_id = ? AND MATCH(content) AGAINST (?) > 0
       ORDER BY score DESC
       LIMIT ?`,
      [query, chatId, query, limit]
    );

    return rows.map(r => ({ content: r.content, score: r.score }));
  }
}
