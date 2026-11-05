import { registerWhisperHost } from "../../src/dictation/whisper-host";

registerWhisperHost();

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (typeof message === "object" && message !== null) {
    if (Reflect.get(message, "type") === "frame-notes:whisper-host-ping") {
      sendResponse({ ready: true });
    }
  }
});

void browser.runtime.sendMessage({ type: "frame-notes:whisper-host-ready" }).catch(() => undefined);
