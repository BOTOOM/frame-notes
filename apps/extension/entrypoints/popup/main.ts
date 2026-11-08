import { Copy, createElement } from "lucide";
import { createBrandGlyphSvg } from "../../src/brand-glyph";
import {
  dictationEngineStorageName,
  isDictationEngineChoice,
  saveDictationEngineChoice,
} from "../../src/dictation/preferences";
import {
  currentLocale,
  getLocalePreferenceSnapshot,
  isLocalePreference,
  LOCALE_PREFERENCES,
  setLocalePreference,
  startLocalePreferenceWatch,
  subscribeLocale,
  t,
} from "../../src/i18n";
import "./style.css";

const namespace = "frame-notes:v1";
const root = document.querySelector<HTMLDivElement>("#root");
let renderGeneration = 0;
startLocalePreferenceWatch();

interface TabStatus {
  detected: boolean;
  project: string | null;
  noteCount: number;
}

function button(text: string, disabled: boolean, handler: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = text;
  element.disabled = disabled;
  element.addEventListener("click", handler);
  return element;
}

async function openPopup(): Promise<void> {
  if (!root) return;
  const generation = ++renderGeneration;
  const locale = currentLocale();
  document.documentElement.lang = locale;
  document.title = t("appName", locale);
  root.replaceChildren();
  const brand = document.createElement("div");
  brand.className = "brand";
  const mark = document.createElement("span");
  mark.className = "brand-mark";
  mark.append(createBrandGlyphSvg());
  const heading = document.createElement("h1");
  heading.textContent = t("appName", locale);
  brand.append(mark, heading);
  root.append(brand);

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (generation !== renderGeneration) return;
  let status: TabStatus = { detected: false, project: null, noteCount: 0 };
  if (tab?.id !== undefined) {
    try {
      status = await browser.tabs.sendMessage(tab.id, { namespace, type: "status" });
    } catch {
      status = { detected: false, project: null, noteCount: 0 };
    }
  }
  if (generation !== renderGeneration) return;

  const summary = document.createElement("div");
  summary.className = status.detected ? "detected" : "unsupported";
  summary.textContent = status.detected ? t("detected", locale) : t("unsupported", locale);
  root.append(summary);

  if (status.detected) {
    const count = document.createElement("p");
    count.className = "count";
    count.textContent = `${status.noteCount} ${t("notes", locale)} · ${status.project ?? t("unknownProject", locale)}`;
    root.append(count);
    const copyAll = button(t("copyAll", locale), false, () => {
      if (tab?.id !== undefined) {
        void browser.tabs.sendMessage(tab.id, { namespace, type: "copy" }).catch(() => undefined);
      }
    });
    copyAll.className = "copy-all";
    copyAll.prepend(
      createElement(Copy, {
        width: 14,
        height: 14,
        strokeWidth: 2,
        "aria-hidden": "true",
        focusable: "false",
      }),
    );
    root.append(copyAll);
  }

  const engineLabel = document.createElement("label");
  engineLabel.className = "dictation-choice";
  const engineTitle = document.createElement("span");
  engineTitle.textContent = t("dictationEngine", locale);
  const engine = document.createElement("select");
  const choices = [
    ["auto", t("dictationAuto", locale)],
    ["chrome-local", t("dictationChrome", locale)],
    ["whisper", t("dictationWhisper", locale)],
  ] as const;
  for (const [value, label] of choices) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    engine.append(option);
  }
  const savedChoice = await browser.storage.local
    .get(dictationEngineStorageName)
    .then((values) => values[dictationEngineStorageName])
    .catch(() => null);
  if (generation !== renderGeneration) return;
  engine.value = isDictationEngineChoice(savedChoice) ? savedChoice : "auto";
  engine.addEventListener("change", () => {
    if (isDictationEngineChoice(engine.value)) {
      void saveDictationEngineChoice(engine.value).catch(() => undefined);
    }
  });
  engineLabel.append(engineTitle, engine);
  root.append(engineLabel);

  const languageLabel = document.createElement("label");
  languageLabel.className = "dictation-choice";
  const languageTitle = document.createElement("span");
  languageTitle.textContent = t("language", locale);
  const language = document.createElement("select");
  for (const choice of LOCALE_PREFERENCES) {
    const option = document.createElement("option");
    option.value = choice;
    option.textContent =
      choice === "auto"
        ? t("languageAuto", locale)
        : choice === "es"
          ? t("languageSpanish", locale)
          : t("languageEnglish", locale);
    language.append(option);
  }
  language.value = getLocalePreferenceSnapshot();
  language.addEventListener("change", () => {
    if (isLocalePreference(language.value)) setLocalePreference(language.value);
  });
  languageLabel.append(languageTitle, language);
  root.append(languageLabel);

  const hints = document.createElement("div");
  hints.className = "hints";
  hints.textContent = t("shortcuts", locale);
  root.append(hints);
}

subscribeLocale(() => void openPopup());
void openPopup();
