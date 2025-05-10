import moment from 'moment';
import 'moment/locale/ru.js';
moment.locale('ru');

export class TimeService {
  static getCurrentTime = () => moment().format('HH:mm');
  static getCurrentDate = () => moment().format('D MMMM YYYY');
  static getDayOfWeek   = () => moment().format('dddd').toLowerCase();
  static getSeason      = () => {
    const m = moment().month()+1;
    if ([12,1,2].includes(m)) return 'зима';
    if ([3,4,5].includes(m)) return 'весна';
    if ([6,7,8].includes(m)) return 'лето';
    return 'осень';
  };
  static getTimeOfDay   = () => {
    const h = moment().hour();
    if (h<5) return 'ночь';
    if (h<12) return 'утро';
    if (h<17) return 'день';
    return 'вечер';
  };
}
