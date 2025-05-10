import axios from 'axios';
import { config } from '../config/index.js';
import { TimeService } from './TimeService.js';
import { recall } from './MemoryService.js';

export class DeepSeekService {
  static addHumanTouch(t){
    const f=['Хмм…','Кстати,','Если честно,','Знаешь,','По правде говоря,'];
    return Math.random()<0.25?`${f[Math.floor(Math.random()*f.length)]} ${t[0].toLowerCase()}${t.slice(1)}`:t;
  }
  static buildMemory(h){
    const s=h.slice(-20).map(m=>`${m.role==='assistant'?'Бот':'Пользователь'}: ${m.content}`).join('\n');
    return `Переписка (кратко):\n${s}\n`;
  }
  static buildProfile(h){
    const txt=h.filter(m=>m.role==='user').map(m=>m.content).join(' ');
    const name=(txt.match(/меня\s+зовут\s+([A-ЯA-ZЁ][a-яa-zё]+)/i)||[])[1]||'друг';
    const tech=/(api|код|js|сервер|sql)/i.test(txt);
    const pet =(txt.match(/(кот|собак|пёс)/gi)||[]).length;
    return `О собеседнике: имя ≈ ${name}; интерес к технике: ${tech?'да':'нет'}; любит говорить о питомцах: ${pet?'да':'нет'}.\n`;
  }

  static async generateResponse(history,settings,emotion,style,user){
    const longMem = await recall(user, history.at(-1)?.content||'');
    const styleCfg=config.STYLES[style]||config.STYLES.INFORMAL;
    const sys=`
Ты человек по имени Алексей. Говори живо, шути, задавай встречные вопросы.
${this.buildMemory(history)}${this.buildProfile(history)}
Актуальные воспоминания:
${longMem.length?longMem.map(t=>'• '+t).join('\n'):'— нет —'}
Сейчас ${TimeService.getCurrentTime()}, ${TimeService.getDayOfWeek()}, сезон ${TimeService.getSeason()}.
${styleCfg.prompt}`.trim();

    const emoMap={
      'радость':'Будь воодушевлён 😊',
      'грусть':'Тон сочувственный 🙁',
      'гнев':'Спокойно и конструктивно',
      'страх':'Поддержи interlocutor'
    };

    try{
      const r=await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model:'deepseek-chat',
          messages:[{role:'system',content:`${sys}\n${emoMap[emotion]||''}`},...history],
          temperature:styleCfg.temp,
          max_tokens:styleCfg.max_tokens
        },
        {headers:{Authorization:`Bearer ${process.env.DEEPSEEK_API_KEY}`}}
      );
      return this.addHumanTouch(r.data.choices[0].message.content.trim());
    }catch(e){
      console.error('DeepSeek error:',e.response?.data||e.message);
      return 'Упс, что-то сломалось 🙃';
    }
  }

  static async generateAnalysis(prompt){
    const r=await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      { model:'deepseek-chat',
        messages:[
          {role:'system',content:'Ты эксперт-комментатор. Объясняй понятно, с эмодзи.'},
          {role:'user',content:prompt}
        ],
        temperature:0.7,max_tokens:400
      },
      {headers:{Authorization:`Bearer ${process.env.DEEPSEEK_API_KEY}`}}
    );
    return r.data.choices[0].message.content.trim();
  }
}
