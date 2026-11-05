export type SpeechAvailability = "available" | "downloadable" | "downloading" | "unavailable";

export interface SpeechLanguageAvailability {
  language: string;
  availability: SpeechAvailability;
}

export type SpeechBridgeRequest =
  | { type: "probe"; requestId: string; languages: string[] }
  | { type: "install"; requestId: string; language: string }
  | { type: "start"; sessionId: string; language: string }
  | { type: "stop"; sessionId: string }
  | { type: "cancel"; sessionId: string };

export type SpeechBridgeEvent =
  | {
      type: "probe-result";
      requestId: string;
      supported: boolean;
      availabilities: SpeechLanguageAvailability[];
    }
  | { type: "install-result"; requestId: string; language: string; installed: boolean }
  | { type: "started"; sessionId: string; language: string }
  | { type: "result"; sessionId: string; final: boolean; transcript: string }
  | { type: "error"; sessionId: string; code: string }
  | { type: "ended"; sessionId: string };

export interface SpeechBridge {
  send: (request: SpeechBridgeRequest) => void;
  subscribe: (listener: (event: SpeechBridgeEvent) => void) => () => void;
}
