import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { config } from '../config/index.js';

export function splitAudio (filePath, segment = 30) {
  return new Promise((ok, bad) => {
    const dir = path.join(config.MEDIA_DIR, 'temp_segments');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    ffmpeg(filePath)
      .outputOptions(['-f','segment','-segment_time',String(segment),'-c','copy'])
      .output(path.join(dir,'seg-%03d.ogg'))
      .on('end',()=>fs.readdir(dir,(e,f)=>e?bad(e):ok(f.map(s=>path.join(dir,s)))))
      .on('error',bad)
      .run();
  });
}
