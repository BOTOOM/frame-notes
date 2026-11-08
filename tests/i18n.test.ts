import { describe, expect, it } from "vitest";
import { LOCALES, type Locale, type Messages, resolveLocale } from "../apps/extension/src/i18n";

describe("locale preference", () => {
  it("resolves auto from the browser language and honors explicit choices", () => {
    expect(resolveLocale("auto", "es-CO")).toBe("es");
    expect(resolveLocale("auto", "en-US")).toBe("en");
    expect(resolveLocale("auto", "fr")).toBe("en");
    expect(resolveLocale("es", "en-US")).toBe("es");
    expect(resolveLocale("en", "es-CO")).toBe("en");
  });

  it("keeps every locale's runtime keys equal to English", () => {
    const localeDictionaries: readonly { locale: Locale; messages: Messages }[] = LOCALES;
    const englishKeys = Object.keys(
      localeDictionaries.find(({ locale }) => locale === "en")?.messages ?? {},
    ).sort();
    for (const { messages } of localeDictionaries) {
      expect(Object.keys(messages).sort()).toEqual(englishKeys);
    }
  });
});
