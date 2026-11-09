import { useSyncExternalStore } from "react";
import { getLocaleSnapshot, subscribeLocale } from "./i18n";

export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleSnapshot);
}
