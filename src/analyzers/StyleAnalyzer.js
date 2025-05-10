import axios from 'axios';
import { config } from '../config/index.js';

/**
 * Автодетект стиля сообщения (для «умного» авто-стиля чата).
 */
export class StyleAnalyzer {
  static async detectStyle(text) {
    const prompt = `
Классифицируй стиль одной меткой из списка:
${Object.keys(config.STYLES).join(', ')}
Ответ только названием стиля. Текст: "${text}"
`.trim();

    try {
      const res = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 10
        },
        { headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` } }
      );

      const st = res.data.choices[0].message.content.trim().toUpperCase();
      return config.STYLES[st] ? st : this.fallback(text);
    } catch {
      return this.fallback(text);
    }
  }

  /** Простой эвристический резерв */
  static fallback(text) {
    const low = text.toLowerCase();
    for (const [style, kws] of Object.entries(config.STYLE_RULES))
      if (kws.some(k => low.includes(k))) return style;
    return 'INFORMAL';
  }
}
