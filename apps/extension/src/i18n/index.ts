import { browser } from "wxt/browser";
import { storage } from "wxt/utils/storage";
import { en, type Messages } from "./en";
import { es } from "./es";

export const LOCALES = [
  { locale: "es", messages: es },
  { locale: "en", messages: en },
] as const satisfies readonly { locale: string; messages: Messages }[];
export type Locale = (typeof LOCALES)[number]["locale"];
export type LocalePreference = "auto" | Locale;
export type TranslationKey = keyof Messages;

export const LOCALE_PREFERENCES: readonly LocalePreference[] = [
  "auto",
  ...LOCALES.map(({ locale }) => locale),
];
export const localeStorageKey: `local:${string}` = "local:frameNotesLocale";
export const localeStorageName = "frameNotesLocale";

const messages = Object.fromEntries(
  LOCALES.map(({ locale: key, messages: dictionary }) => [key, dictionary]),
) as Record<Locale, Messages>;
let preference: LocalePreference = "auto";
const language = typeof navigator === "undefined" ? "en" : navigator.language;
let locale = resolveLocale(preference, language);
let watching = false;
const listeners = new Set<() => void>();

export function isLocalePreference(value: unknown): value is LocalePreference {
  return value === "auto" || LOCALES.some(({ locale: item }) => item === value);
}

export function resolveLocale(value: LocalePreference, languageTag: string): Locale {
  if (value !== "auto") return value;
  return languageTag.toLowerCase().startsWith("es") ? "es" : "en";
}

function updatePreference(value: unknown): void {
  const next = isLocalePreference(value) ? value : "auto";
  const nextLocale = resolveLocale(next, language);
  if (next === preference && nextLocale === locale) return;
  preference = next;
  locale = nextLocale;
  for (const listener of listeners) listener();
}

export function startLocalePreferenceWatch(): void {
  if (watching) return;
  watching = true;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const changed = changes[localeStorageName];
    if (changed && "newValue" in changed) updatePreference(changed.newValue);
  });
  void storage
    .getItem<unknown>(localeStorageKey)
    .then(updatePreference)
    .catch(() => undefined);
}

export function setLocalePreference(value: LocalePreference): void {
  updatePreference(value);
  void storage.setItem(localeStorageKey, value).catch(() => undefined);
}

export function getLocaleSnapshot(): Locale {
  return locale;
}

export function getLocalePreferenceSnapshot(): LocalePreference {
  return preference;
}

export function currentLocale(): Locale {
  return locale;
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key: TranslationKey, selectedLocale: Locale = locale): string {
  return messages[selectedLocale][key];
}
