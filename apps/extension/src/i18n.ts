export type { Messages } from "./i18n/en";
export type { Locale, LocalePreference, TranslationKey } from "./i18n/index";
export {
  currentLocale,
  getLocalePreferenceSnapshot,
  getLocaleSnapshot,
  isLocalePreference,
  LOCALE_PREFERENCES,
  LOCALES,
  localeStorageKey,
  localeStorageName,
  resolveLocale,
  setLocalePreference,
  startLocalePreferenceWatch,
  subscribeLocale,
  t,
} from "./i18n/index";
