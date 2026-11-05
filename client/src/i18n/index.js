import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import so from './so.js';
import en from './en.js';

const lng = localStorage.getItem('lang') || 'so';
document.documentElement.lang = lng;

i18n.use(initReactI18next).init({
  resources: { so: { translation: so }, en: { translation: en } },
  lng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;