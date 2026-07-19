export const TRANSLATION_LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  ar: "Arabic",
  hi: "Hindi",
  zh: "Simplified Chinese",
  ja: "Japanese",
  ko: "Korean",
};

export const TRANSLATION_LANGUAGES = Object.entries(
  TRANSLATION_LANGUAGE_NAMES
).map(([code, name]) => ({ code, name }));
