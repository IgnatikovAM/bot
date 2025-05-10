import axios from 'axios';
import { config } from '../config/index.js';

/**
 * Классификатор намерений:
 *   • weather_request / weather_talk
 *   • date_request   / date_talk
 *   • time_request   / time_talk
 *   • general_chat
 */
export class IntentAnalyzer {
  static async detectIntent(text, isVoice = false) {
    const low = text.toLowerCase();

    /* --- быстрые эвристики ------------------------------------- */
    if (/погод/.test(low) && /(тепл|холод|жарк|пасмурн|солне)/.test(low))
      return 'weather_talk';

    if (/(понедельник|вторник|среда|четверг|пятниц|суббот|воскресен)/.test(low) && !/\?/.test(low))
      return 'date_talk';

    if (/утро|вечер|полдень|ночь/.test(low) && !/\?/.test(low))
      return 'time_talk';

    /* --- голосовые «триггеры» — упрощённо ---------------------- */
    if (isVoice && low.includes('погод')) return 'weather_request';

    /* --- запрос к LLM (DeepSeek) ------------------------------- */
    try {
      const res = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: `${config.INTENT_PROMPT}\nТекст: ${text}` }
          ],
          temperature: 0.1,
          max_tokens: 10
        },
        { headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` } }
      );

      const intent = res.data.choices[0].message.content.trim().toLowerCase();
      return intent;
    } catch {
      return /погод/.test(low) ? 'weather_request' : 'general_chat';
    }
  }
}
