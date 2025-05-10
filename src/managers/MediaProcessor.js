import fs   from 'fs';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';

import { config } from '../config/index.js';
import { splitAudio } from '../utils/splitAudio.js';

/**
 * Обработка входящих медиа:
 *   • images / video / docs → сохраняем файл
 *   • голосовое OGG Opus → STT + текст
 *   • TTS — озвучка для ответов
 */
export class MediaProcessor {

  /* ---------- парсинг входящего сообщения ---------------------- */
  static async handle(msg) {
    if (!msg.hasMedia) return { type: 'text', content: msg.body };

    try {
      const media = await msg.downloadMedia();

      /* --- голосовое сообщение (OGG Opus) ----------------------- */
      if (media.mimetype === 'audio/ogg; codecs=opus') {
        const text = await this.convertVoiceToText(media.data);
        const hash = crypto.createHash('md5').update(media.data).digest('hex');
        return {
          type: 'voice',
          content: text,
          original_audio: media.data,
          audio_hash: hash,
          media_url: null
        };
      }

      /* --- слишком большой файл (>5 МБ) ------------------------ */
      if (media.data.length > 5 * 1024 * 1024)
        return { type: 'text', content: 'Файл слишком большой' };

      /* --- сохраняем файл -------------------------------------- */
      const hash = crypto.createHash('md5').update(media.data).digest('hex');
      const ext  = media.mimetype.split('/')[1];
      const file = path.join(config.MEDIA_DIR, `${hash}.${ext}`);
      if (!fs.existsSync(file)) fs.writeFileSync(file, media.data, 'base64');

      const kind = media.mimetype.startsWith('image')  ? 'image'
                : media.mimetype.startsWith('video')  ? 'video'
                : media.mimetype.startsWith('audio')  ? 'audio'
                : 'document';

      return { type: kind, content: '', media_url: file };

    } catch {
      return { type: 'text', content: 'Ошибка обработки медиа' };
    }
  }

  /* ---------- STT (Yandex) ------------------------------------- */
  static async convertVoiceToText(b64) {
    const buf  = Buffer.from(b64, 'base64');
    const temp = path.join(config.MEDIA_DIR, `temp_${Date.now()}.ogg`);
    fs.writeFileSync(temp, buf);

    /* узнаём длину */
    const dur = await new Promise((ok, bad) =>
      ffmpeg.ffprobe(temp, (e, m) => e ? bad(e) : ok(m.format.duration)));

    const recognize = async data => {
      const r = await axios.post(
        config.SPEECHKIT_SETTINGS.STT_URL, Buffer.from(data, 'base64'),
        {
          params: {
            folderId: process.env.YANDEX_FOLDER_ID,
            lang: config.SPEECHKIT_SETTINGS.LANG,
            sampleRateHertz: config.SPEECHKIT_SETTINGS.SAMPLE_RATE
          },
          headers: {
            Authorization: `Api-Key ${process.env.YANDEX_API_KEY}`,
            'Content-Type': `audio/${config.SPEECHKIT_SETTINGS.FORMAT}`
          }
        }
      );
      return r.data.result || '';
    };

    let text = '';
    if (dur > 30) {
      for (const seg of await splitAudio(temp, 30)) {
        const data = fs.readFileSync(seg, 'base64');
        text += (await recognize(data)) + ' ';
        fs.unlinkSync(seg);
      }
    } else {
      text = await recognize(b64);
    }
    fs.unlinkSync(temp);
    return text || 'Не удалось распознать речь';
  }

  /* ---------- TTS (Yandex) ------------------------------------- */
  static async textToSpeech(text, voice) {
    try {
      const r = await axios.post(
        config.SPEECHKIT_SETTINGS.TTS_URL, null,
        {
          params: {
            text,
            voice: voice || config.SPEECHKIT_SETTINGS.VOICE,
            format: config.SPEECHKIT_SETTINGS.FORMAT,
            sampleRateHertz: config.SPEECHKIT_SETTINGS.SAMPLE_RATE,
            folderId: process.env.YANDEX_FOLDER_ID
          },
          headers: { Authorization: `Api-Key ${process.env.YANDEX_API_KEY}` },
          responseType: 'arraybuffer'
        }
      );
      const hash = crypto.createHash('md5').update(text).digest('hex');
      const file = path.join(config.MEDIA_DIR, `${hash}.${config.SPEECHKIT_SETTINGS.FILE_EXT}`);
      if (!fs.existsSync(file)) fs.writeFileSync(file, r.data);
      return { path: file, hash };
    } catch (e) {
      console.error('TTS error:', e.response?.data || e.message);
      return null;
    }
  }
}
