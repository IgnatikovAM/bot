import { pool }   from '../db/pool.js';
import { config } from '../config/index.js';

/**
 * Работа с MySQL-историей чата — CRUD + авто-стиль.
 */
export class ChatManager {

  /* ---------- создание динамической таблицы сообщений ---------- */
  static async createMessagesTableIfNotExists(name) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ?? (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id INT,
        message_id VARCHAR(255),
        outgoing_message_id VARCHAR(255),
        content TEXT,
        is_bot TINYINT(1),
        type VARCHAR(50),
        mood VARCHAR(50),
        style VARCHAR(50),
        audio_hash VARCHAR(255),
        tts_hash VARCHAR(255),
        media_url TEXT,
        weather_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`, [name]);
  }

  /* ---------- чтение последних N сообщений -------------------- */
  static async getHistory(table) {
    const [rows] = await pool.query(
      'SELECT content, type, is_bot, mood, style FROM ?? ORDER BY created_at DESC LIMIT ?',
      [table, config.CHAT_HISTORY_LIMIT]
    );
    return rows.reverse().map(r => ({
      role: r.is_bot ? 'assistant' : 'user',
      content: r.content,
      mood: r.mood,
      style: r.style
    }));
  }

  /* ---------- сохранение сообщения ---------------------------- */
  static async saveMessage(
    table, chatId, content, isBot = false, type = 'text', mood = 'нейтральный',
    style = 'INFORMAL', audioHash = null, ttsHash = null,
    mediaUrl = null, weatherData = null,
    incomingId = null, outgoingId = null
  ) {
    await pool.query(`
      INSERT INTO ?? (chat_id, message_id, outgoing_message_id, content, is_bot,
                      type, mood, style, audio_hash, tts_hash, media_url, weather_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [table, chatId, incomingId, outgoingId, content, isBot, type, mood, style,
       audioHash, ttsHash, mediaUrl, weatherData ? JSON.stringify(weatherData) : null]);
  }

  /* ---------- настройки чата ----------------------------------- */
  static async getChatSettings(id) {
    const [rows] = await pool.query(
      'SELECT style, mood, auto_style, tts_enabled, tts_voice FROM chats WHERE id = ?',
      [id]
    );
    return rows[0] || {
      style: 'INFORMAL', mood: 'нейтральный',
      auto_style: config.AUTO_STYLE,
      tts_enabled: false, tts_voice: config.SPEECHKIT_SETTINGS.VOICE
    };
  }
  static updateStyle     = (id, s)  => pool.query('UPDATE chats SET style = ?, auto_style = false WHERE id = ?', [s, id]);
  static toggleAutoStyle = (id, b)  => pool.query('UPDATE chats SET auto_style = ? WHERE id = ?', [b, id]);
  static toggleTTS       = (id, b)  => pool.query('UPDATE chats SET tts_enabled = ? WHERE id = ?', [b, id]);
  static updateVoice     = (id, v)  => pool.query('UPDATE chats SET tts_voice = ? WHERE id = ?', [v, id]);

  static async getLastUsedCity(table) {
    const [r] = await pool.query(
      'SELECT content FROM ?? WHERE type = "weather" ORDER BY id DESC LIMIT 1', [table]);
    return r[0]?.content.match(/в ([\w\s-]+)/i)?.[1];
  }

  /* ---------- авто-стиль (Category / Interaction) -------------- */
  static analyzeCategory(messages, category) {
    return messages.reduce((acc, m) => {
      const st = config.STYLES[m.style];
      if (st?.category === category) acc[m.style] = (acc[m.style] || 0) + 1;
      return acc;
    }, {});
  }

  static calculateOptimal(ctx, inter) {
    const topCtx   = Object.entries(ctx).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'FRIENDLY';
    const topInter = Object.entries(inter).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'ASSERTIVE';
    const combo    = `${topCtx}_${topInter}`;
    return config.STYLES[combo] ? { style: combo } : { style: 'INFORMAL' };
  }

  static async applyAutoStyle(history) {
    return this.calculateOptimal(
      this.analyzeCategory(history, 'context'),
      this.analyzeCategory(history, 'interaction')
    );
  }
}
