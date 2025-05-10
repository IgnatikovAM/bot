/**
 * Глобальная конфигурация бота.
 * Импортируется как:
 *   import { config } from '../config/index.js';
 */

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  /* ---------------- общие параметры ---------------- */
  MEDIA_DIR: './media',           // куда сохранять файлы, модели, аудио
  CHAT_HISTORY_LIMIT: 5,          // «краткая» память (N последних сообщений)

  /* ---------------- допустимые медиа ---------------- */
  ALLOWED_MIME_TYPES: new Set([
    'image/jpeg',
    'image/png',
    'audio/ogg; codecs=opus'
  ]),

  /* ---------------- стили генерации ----------------- */
  STYLES: {
    TECHNICAL: {
      temp: 0.3,  max_tokens: 500,
      prompt: 'Чёткий структурированный ответ с профессиональной терминологией 📊',
      category: 'context'
    },
    CREATIVE: {
      temp: 0.9,  max_tokens: 1000,
      prompt: 'Креативный ответ с метафорами и нестандартными идеями 🎨',
      category: 'context'
    },
    FRIENDLY: {
      temp: 0.7,  max_tokens: 700,
      prompt: 'Неформальный ответ со сленгом и юмором 👫',
      category: 'context'
    },
    ROMANTIC: {
      temp: 0.8,  max_tokens: 800,
      prompt: 'Эмоциональный ответ с лирическими образами 💖',
      category: 'context'
    },
    ASSERTIVE: {
      temp: 0.5,  max_tokens: 600,
      prompt: 'Уважительный и прямой стиль общения 🤝',
      category: 'interaction'
    },
    PASSIVE: {
      temp: 0.6,  max_tokens: 400,
      prompt: 'Нейтральный ответ без выраженной позиции 😐',
      category: 'interaction'
    },
    EMOTIONAL: {
      temp: 0.85, max_tokens: 750,
      prompt: 'Эмоционально окрашенный ответ с эмодзи 😊',
      category: 'emotion'
    },
    RATIONAL: {
      temp: 0.4,  max_tokens: 500,
      prompt: 'Логичный ответ с фактами и аргументами 📈',
      category: 'emotion'
    },
    FORMAL: {
      temp: 0.4,  max_tokens: 400,
      prompt: 'Официальный стиль с соблюдением правил 📄',
      category: 'formality'
    },
    INFORMAL: {
      temp: 0.7,  max_tokens: 600,
      prompt: 'Разговорный стиль с простыми конструкциями 💬',
      category: 'formality'
    },
    FRIENDLY_ASSERTIVE: {
      temp: 0.6,  max_tokens: 650,
      prompt: 'Дружелюбный и уверенный стиль общения 😊🤝'
    },
    HUMAN_LIKE: {
      temp: 0.75, max_tokens: 800,
      prompt: 'Общайся как обычный человек по имени Алексей: используй междометия, эмоции, личный опыт. Иногда задавай встречные вопросы.'
    }
  },

  /* ---------------- список эмоций ------------------- */
  EMOTION_TYPES: [
    'радость','интерес','любовь','благодарность','надежда',
    'гнев','страх','грусть','стыд','ревность',
    'разочарование','удивление','смущение','нейтральный'
  ],

  /* ---------------- алиасы городов ------------------ */
  CITY_ALIASES: {
    'питер':'Saint Petersburg',
    'спб':'Saint Petersburg',
    'мск':'Moscow',
    'москва':'Moscow',
    'нск':'Novosibirsk'
  },

  /* ---------------- режимы погоды ------------------- */
  WEATHER_MODES: {
    NOW: 'current',
    TODAY: 'today',
    FORECAST: 'forecast',
    BRIEF: 'brief'
  },

  /* ---------------- ключевые слова погоды ----------- */
  WEATHER_TRIGGERS: [
    'погода','погод','дождь','снег','солнце',
    'температура','ветер','осадки','шторм','гроза'
  ],

  /* ---------------- intent-prompt для LLM ------------ */
  INTENT_PROMPT: `
Определи намерение. Возможные значения:
  • weather_request – пользователь явно просит факт или прогноз
  • weather_talk    – просто упоминает/комментирует погоду
  • date_request    – просит назвать дату или день недели
  • date_talk       – упоминает дату/день без запроса
  • time_request    – спрашивает точное время
  • time_talk       – говорит о времени без запроса
  • general_chat
Ответ ровно одним словом.`.trim(),

  /* ---------------- общий дефолт-город --------------- */
  DEFAULT_CITY: 'Saint Petersburg',

  /* ---------------- флаг авто-стиля ------------------ */
  AUTO_STYLE: true,

  /* ---------------- правила авто-детекта стиля ------- */
  STYLE_RULES: {
    TECHNICAL: ['технич','настройк','параметр','ошибк','логи','api'],
    CREATIVE:  ['придумай','историю','креатив','вообрази','творчеств'],
    ROMANTIC:  ['любов','сердце','чувств','роман','мечт'],
    PASSIVE:   ['не знаю','без разницы','решай сам','как скажешь'],
    ASSERTIVE: ['мнение','позици','согласен','уважен','конструктив'],
    FORMAL:    ['уважаем','прошу','заявка','документ','официал']
  },

  /* ---------------- настройки Yandex SpeechKit ------- */
  SPEECHKIT_SETTINGS: {
    STT_URL:  'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize',
    TTS_URL:  'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize',
    FORMAT:   'oggopus',
    FILE_EXT: 'opus',
    LANG:     'ru-RU',
    VOICE:    'alena',
    SAMPLE_RATE: 48000
  }
};
