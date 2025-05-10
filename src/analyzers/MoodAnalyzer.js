import axios from 'axios';
import { config } from '../config/index.js';

/**
 * Определение эмоции по сообщению пользователя
 * (на основе DeepSeek-Chat; fallback — «нейтральный»).
 */
export class MoodAnalyzer {
  static async detectMood(text) {
    try {
      const res = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `Определи эмоцию: ${config.EMOTION_TYPES.join(', ')}. Ответ одним словом.`
            },
            { role: 'user', content: text }
          ],
          temperature: 0.1,
          max_tokens: 15
        },
        { headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` } }
      );

      const emo = res.data.choices[0].message.content.trim().toLowerCase();
      return config.EMOTION_TYPES.includes(emo) ? emo : 'нейтральный';
    } catch {
      return 'нейтральный';
    }
  }
}
