export function isExplicitRequest (text='') {
  const kw = ['покажи','выведи','скажи','дай','расскажи','сколько','какая'];
  return kw.some(k => text.toLowerCase().includes(k)) || text.trim().endsWith('?');
}
