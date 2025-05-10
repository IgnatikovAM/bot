/**********************************************************************
 * Точка входа бота WhatsApp + DeepSeek
 * -------------------------------------------------
 * • RAG-память (локальные эмбеддинги → MemoryService)
 * • Краткосрочная история → ChatManager
 * • Озвучка через Yandex SpeechKit
 * • OpenWeather для погоды
 *********************************************************************/

import fs from 'fs';
import qrcode from 'qrcode-terminal';
import WhatsAppWeb from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = WhatsAppWeb;

import { config } from './config/index.js';
import { runMigrations } from './db/migrations.js';
import { pool } from './db/pool.js';

import { serviceTypes, allowedTypes } from './constants.js';
import { isExplicitRequest } from './utils/helpers.js';
import { CityParser } from './utils/CityParser.js';

import { MediaProcessor } from './managers/MediaProcessor.js';
import { ChatManager }   from './managers/ChatManager.js';

import { IntentAnalyzer } from './analyzers/IntentAnalyzer.js';
import { MoodAnalyzer }   from './analyzers/MoodAnalyzer.js';
import { StyleAnalyzer }  from './analyzers/StyleAnalyzer.js';

import { WeatherService } from './services/WeatherService.js';
import { DeepSeekService } from './services/DeepSeekService.js';
import { TimeService }   from './services/TimeService.js';
import { remember }      from './services/MemoryService.js';

const BOT_START = Math.floor(Date.now() / 1000);

/* ------------------------------------------------------------------ */
/* миграции БД + директории                                            */
await runMigrations();
if (!fs.existsSync(config.MEDIA_DIR)) fs.mkdirSync(config.MEDIA_DIR, { recursive: true });

/* ------------------------------------------------------------------ */
/* клиент WhatsApp                                                     */
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './sessions' }),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  fs.writeFileSync('qrcode.txt', qr);
});
client.on('ready', () => console.log('✅ Бот запущен!'));

/* ------------------------------------------------------------------ */
/* вспомогательная функция уведомлений                                 */
async function saveNotification(chat, type, body) {
  await pool.query(
    'INSERT INTO notifications (chat, type, message) VALUES (?, ?, ?)',
    [chat, type, body]
  );
}

/* ------------------------------------------------------------------ */
/* логируем ВСЕ служебные сообщения                                    */
client.on('message', m => {
  if (serviceTypes.has(m.type))
    saveNotification(m.from, m.subtype || m.type, m.body);
});

/* ------------------------------------------------------------------ */
/* основной обработчик                                                 */
client.on('message', async (msg) => {
  if (msg.fromMe || serviceTypes.has(msg.type)) return;

  /* ---- MediaProcessor разбирает голос / файлы / т.д. ---- */
  const m = await MediaProcessor.handle(msg);
  if (!allowedTypes.has(m.type)) {
    saveNotification(msg.from, m.type, m.content || '[медиа]');
    return;
  }

  /* ---- основные данные чата ---- */
  const phone   = msg.from.split('@')[0];
  const table   = `messages_${phone}`;
  const explicit = isExplicitRequest(m.content);

  /* ---- RAG-память: запоминаем каждое сообщение юзера ---- */
  await remember(phone, m.content);

  /* ---- БД чатов / таблица истории ---- */
  const [ins] = await pool.query(
    'INSERT INTO chats (contact) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
    [phone]
  );
  const chatId = ins.insertId;
  await ChatManager.createMessagesTableIfNotExists(table);

  /* ---- определяем эмоцию ---- */
  const mood = await MoodAnalyzer.detectMood(m.content);

  /* ---- сохраняем входящее ---- */
  await ChatManager.saveMessage(
    table, chatId,
    m.content || '[медиа]', false, m.type, mood, 'INFORMAL',
    m.audio_hash, null, m.media_url, null,
    msg.id._serialized, null
  );

  /* ---- не отвечаем на старые сообщения до запуска ---- */
  if (msg.timestamp < BOT_START) return;

  /* ---- настройки + авто-стиль ---- */
  const settings = await ChatManager.getChatSettings(chatId);
  let   style    = settings.style;
  if (settings.auto_style) {
    const auto = await ChatManager.applyAutoStyle(await ChatManager.getHistory(table));
    style = config.STYLES[auto.style] ? auto.style : 'INFORMAL';
  }

  /* ---- извлекаем город (или последний использованный) ---- */
  const city = CityParser.extractCity(m.content)
           || await ChatManager.getLastUsedCity(table)
           || config.DEFAULT_CITY;

  /* ---- Intent ---------------------------------------------------- */
  const intent = await IntentAnalyzer.detectIntent(m.content, m.type === 'voice');

  let reply     = '';
  let outType   = 'text';
  let weather   = null;

  /* ----------------------------------------------------------------
   *                    ОБРАБОТКА INTENT'ОВ
   * ----------------------------------------------------------------*/
  switch (intent) {

    /* ---------- ЯВНЫЙ ЗАПРОС ФАКТА / ПРОГНОЗА ПОГОДЫ ------------- */
    case 'weather_request': {
      weather = await WeatherService.getWeatherForecast(city, 'current');
      if (weather.error) { reply = weather.error; break; }

      reply = explicit
        ? await WeatherService.generateWeatherReport(weather, 'current')
        : await DeepSeekService.generateAnalysis(
            `Сформируй короткий дружелюбный ответ: ${weather.temp}°C, ${weather.description}.`
          );
      outType = 'weather';
      break;
    }

    /* ---------- РАЗГОВОР О ПОГОДЕ (без запроса) ------------------ */
    case 'weather_talk': {
      weather = await WeatherService.getWeatherForecast(city, 'current');
      reply   = await DeepSeekService.generateAnalysis(
        `Собеседник упомянул погоду (${weather.description}). Поддержи разговор без цифр.`
      );
      outType = 'weather';
      break;
    }

    /* ---------- ЯВНЫЙ ЗАПРОС ДАТЫ ------------------------------- */
    case 'date_request': {
      reply = explicit
        ? `📅 ${TimeService.getCurrentDate()}`
        : await DeepSeekService.generateAnalysis(
            'Скажи что-нибудь о сегодняшнем дне, не называя число.'
          );
      break;
    }

    /* ---------- БОЛТОВНЯ О ДНЕ / ДАТЕ ---------------------------- */
    case 'date_talk': {
      reply = await DeepSeekService.generateAnalysis(
        'Собеседник упоминает дату или день. Поддержи без точных чисел.'
      );
      break;
    }

    /* ---------- ЯВНЫЙ ЗАПРОС ВРЕМЕНИ ----------------------------- */
    case 'time_request': {
      reply = explicit
        ? `🕒 ${TimeService.getCurrentTime()}`
        : await DeepSeekService.generateAnalysis(
            'Ответь о времени, избегая точных цифр.'
          );
      break;
    }

    /* ---------- РАЗГОВОР О ВРЕМЕНИ ------------------------------- */
    case 'time_talk': {
      reply = await DeepSeekService.generateAnalysis(
        'Собеседник упомянул время суток. Поддержи разговор.'
      );
      break;
    }

    /* ---------- ОБЫЧНЫЙ ДИАЛОГ ----------------------------------- */
    default: {
      reply = await DeepSeekService.generateResponse(
        [...await ChatManager.getHistory(table),
         { role: 'user', content: m.content, mood }],
        settings, mood, style, phone
      );
    }
  }

  /* ----------------------------------------------------------------
   *                    ОТПРАВКА ОТВЕТА
   * ----------------------------------------------------------------*/
  async function logAndSave(sent, tp, ttsHash = null) {
    await ChatManager.saveMessage(
      table, chatId,
      reply, true, tp, mood, style,
      null, ttsHash, null, weather,
      msg.id._serialized, sent.id._serialized
    );
  }

  /* ---- если аудио-вход → отвечаем голосом ---- */
  if (m.type === 'voice') {
    const tts = await MediaProcessor.textToSpeech(reply, settings.tts_voice);
    if (tts) {
      const media = MessageMedia.fromFilePath(tts.path, { mimeType: 'audio/ogg; codecs=opus' });
      const sent  = await client.sendMessage(msg.from, media, { sendAudioAsVoice: true });
      await logAndSave(sent, 'voice', tts.hash);
      return;
    }
  }

  /* ---- если авто-озвучка включена ---- */
  if (settings.tts_enabled && m.type !== 'voice') {
    const tts = await MediaProcessor.textToSpeech(reply, settings.tts_voice);
    if (tts) {
      const sentTxt = await client.sendMessage(msg.from, reply);
      const media   = MessageMedia.fromFilePath(tts.path, { mimeType: 'audio/ogg; codecs=opus' });
      await client.sendMessage(msg.from, media, { sendAudioAsVoice: true });
      await logAndSave(sentTxt, 'voice', tts.hash);
      return;
    }
  }

  /* ---- обычный текстовый ответ ---- */
  const sent = await client.sendMessage(msg.from, reply);
  await logAndSave(sent, outType);
});

/* ------------------------------------------------------------------ */
client.initialize();
