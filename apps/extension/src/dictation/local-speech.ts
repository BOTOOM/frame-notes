import type { SpeechBridgeEvent, SpeechBridgeRequest } from "./protocol";
import {
  checkSpeechLanguages,
  findSpeechRecognitionApi,
  type SpeechRecognitionInstance,
  startLocalRecognition,
} from "./speech";

export function createSpeechCommandHandler(
  win: typeof globalThis,
  emit: (event: SpeechBridgeEvent) => void,
): (request: SpeechBridgeRequest) => Promise<void> {
  const speechApi = findSpeechRecognitionApi(win);
  let speechRecognition: SpeechRecognitionInstance | null = null;
  let speechSessionId: string | null = null;

  return async (request) => {
    if (request.type === "probe") {
      if (!speechApi) {
        emit({
          type: "probe-result",
          requestId: request.requestId,
          supported: false,
          availabilities: [],
        });
        return;
      }
      const availabilities = await checkSpeechLanguages(speechApi, request.languages);
      emit({
        type: "probe-result",
        requestId: request.requestId,
        supported: true,
        availabilities,
      });
      return;
    }
    if (request.type === "install") {
      if (!speechApi) {
        emit({
          type: "install-result",
          requestId: request.requestId,
          language: request.language,
          installed: false,
        });
        return;
      }
      const install = speechApi.install({ langs: [request.language], processLocally: true });
      void install.then(
        (installed) =>
          emit({
            type: "install-result",
            requestId: request.requestId,
            language: request.language,
            installed,
          }),
        () =>
          emit({
            type: "install-result",
            requestId: request.requestId,
            language: request.language,
            installed: false,
          }),
      );
      return;
    }
    if (!speechApi) {
      emit({ type: "error", sessionId: request.sessionId, code: "unsupported" });
      return;
    }
    if (request.type === "start") {
      speechRecognition?.abort();
      speechSessionId = request.sessionId;
      try {
        speechRecognition = startLocalRecognition(speechApi, request.language, {
          onResult: (transcript, final) =>
            emit({ type: "result", sessionId: request.sessionId, transcript, final }),
          onError: (code) => emit({ type: "error", sessionId: request.sessionId, code }),
          onEnd: () => {
            if (speechSessionId !== request.sessionId) return;
            speechRecognition = null;
            speechSessionId = null;
            emit({ type: "ended", sessionId: request.sessionId });
          },
        });
        emit({
          type: "started",
          sessionId: request.sessionId,
          language: request.language,
        });
      } catch {
        speechRecognition = null;
        speechSessionId = null;
        emit({ type: "error", sessionId: request.sessionId, code: "start-failed" });
      }
      return;
    }
    if (speechSessionId !== request.sessionId) return;
    if (request.type === "stop") speechRecognition?.stop();
    else {
      speechRecognition?.abort();
      speechRecognition = null;
      speechSessionId = null;
      emit({ type: "ended", sessionId: request.sessionId });
    }
  };
}
