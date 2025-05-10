import axios from 'axios';
import moment from 'moment';
import { config } from '../config/index.js';
import { TimeService } from './TimeService.js';

export class WeatherService {
  static normalizeCity (city) {
    if (!city || typeof city !== 'string') return config.DEFAULT_CITY;

    const cleaned = city.toLowerCase()
      .replace(/ё/g,'е')
      .replace(/[^a-zа-я\s-]/g,'')
      .trim();

    const alias  = config.CITY_ALIASES[cleaned];
    const result = alias || cleaned;
    return result.length ? result : config.DEFAULT_CITY;
  }

  static async getWeatherForecast (city, mode='current') {
    const q = encodeURIComponent(this.normalizeCity(city));

    const url = mode === 'current'
      ? `https://api.openweathermap.org/data/2.5/weather?q=${q}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric&lang=ru`
      : mode === 'today'    ? build(8)
      : mode === 'tomorrow' ? build(16)
      : mode === 'week'     ? build(40)
      : build(40);

    function build(cnt){
      return `https://api.openweathermap.org/data/2.5/forecast?q=${q}&cnt=${cnt}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric&lang=ru`;
    }

    try {
      const res = await axios.get(url);
      if (res.data.cod !== '200' && res.data.cod !== 200)
        return { error:'Город не найден' };
      return this.parseWeatherData(res.data, mode);
    } catch (e) {
      console.error('OpenWeather error:', e.response?.data||e.message);
      return { error:'Ошибка получения данных' };
    }
  }

  static parseWeatherData (data, mode) {
    if (mode==='current'){
      return {
        city:data.name,
        temp:Math.round(data.main.temp),
        feels_like:Math.round(data.main.feels_like),
        description:data.weather[0].description,
        wind:Math.round(data.wind.speed),
        humidity:data.main.humidity,
        pressure:Math.round(data.main.pressure*0.75),
        rain:data.rain?data.rain['1h']||0:0
      };
    }
    let list=data.list||[];
    if (mode==='tomorrow'){
      const tom = moment().add(1,'day').format('YYYY-MM-DD');
      list = list.filter(i=>i.dt_txt.startsWith(tom));
    }
    return {
      city:data.city?.name||'N/A',
      list:list.map(i=>({
        dt:i.dt_txt,
        time:moment(i.dt_txt).format('DD.MM HH:mm'),
        temp:Math.round(i.main.temp),
        icon:i.weather[0].icon,
        description:i.weather[0].description
      }))
    };
  }

  static getTrend (d){
    if (!d.list||d.list.length<2) return '';
    const diffs=d.list.slice(1).map((v,i)=>v.temp-d.list[i].temp);
    const avg=diffs.reduce((a,b)=>a+b,0)/diffs.length;
    if (avg>1)  return 'Погода улучшается.';
    if (avg<-1) return 'Погода ухудшается.';
    return 'Погода остаётся стабильной.';
  }

  static async generateWeatherReport(data,mode){
    const season=TimeService.getSeason(),
          tod=TimeService.getTimeOfDay();

    if (mode==='current' && !data.list){
      return `Сейчас в городе ${data.city} ${data.temp}°C (ощущается как ${data.feels_like}°C).
Описание: ${data.description}.
Ветер ${data.wind} м/с, влажность ${data.humidity}%.
Сезон: ${season}, время суток: ${tod}.`;
    }

    if (!data.list?.length) return 'Не удалось получить прогноз.';

    let prompt=`Сформируй ответ о погоде в городе ${data.city}.
Режим: ${mode}. Сезон: ${season}. Время суток: ${tod}.
Список:\n`;
    data.list.forEach(i=>prompt+=`${i.time}: ${i.temp}°C, ${i.description}\n`);
    prompt+=`\n${this.getTrend(data)}\nДобавь советы по одежде.\n`;

    const { DeepSeekService } = await import('./DeepSeekService.js');
    return DeepSeekService.generateAnalysis(prompt);
  }
}
