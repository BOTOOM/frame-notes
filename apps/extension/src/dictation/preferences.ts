import { useEffect, useState } from "react";
import { storage } from "wxt/utils/storage";
import type { DictationEngineChoice } from "./helpers";

export const dictationEngineStorageKey: `local:${string}` = "local:frame-notes:dictation-engine";
export const dictationEngineStorageName = "frame-notes:dictation-engine";
export const whisperConsentStorageKey: `local:${string}` = "local:frame-notes:whisper-consented";

export function isDictationEngineChoice(value: unknown): value is DictationEngineChoice {
  return value === "auto" || value === "chrome-local" || value === "whisper";
}

export async function saveDictationEngineChoice(choice: DictationEngineChoice): Promise<void> {
  await storage.setItem(dictationEngineStorageKey, choice);
}

export function useDictationEngineChoice(): DictationEngineChoice {
  const [choice, setChoice] = useState<DictationEngineChoice>("auto");
  useEffect(() => {
    let active = true;
    void storage
      .getItem<unknown>(dictationEngineStorageKey)
      .then((saved) => {
        if (active) setChoice(isDictationEngineChoice(saved) ? saved : "auto");
      })
      .catch(() => undefined);
    const handleChange: Parameters<typeof browser.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area !== "local") return;
      const changed = changes[dictationEngineStorageName];
      if ("newValue" in (changed ?? {})) {
        setChoice(isDictationEngineChoice(changed?.newValue) ? changed.newValue : "auto");
      }
    };
    browser.storage.onChanged.addListener(handleChange);
    return () => {
      active = false;
      browser.storage.onChanged.removeListener(handleChange);
    };
  }, []);
  return choice;
}
