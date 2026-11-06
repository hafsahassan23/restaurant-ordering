export const money = (n) => `$${Number(n).toFixed(2)}`;

/** Pick the Somali or English field: pick(dish, 'name', lang) -> dish.name_so / dish.name_en */
export const pick = (obj, field, lang) => (lang.startsWith('en') ? obj[`${field}_en`] : obj[`${field}_so`]);

export const minutesSince = (iso, now) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

export const mmss = (iso, now) => {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};