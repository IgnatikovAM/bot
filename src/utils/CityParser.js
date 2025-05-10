import { config } from '../config/index.js';

export class CityParser {
  static extractCity (text) {
    const low = text.toLowerCase();
    for (const alias in config.CITY_ALIASES)
      if (low.includes(alias)) return config.CITY_ALIASES[alias];

    const r = /(?:в|на|для|по|у|около|возле)\s+([а-яё\s-]+)/gi;
    const m = [...text.matchAll(r)]
      .map(x => x[1].trim())
      .find(c => c.length > 2);
    return m || config.DEFAULT_CITY;
  }
}
