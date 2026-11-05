type WhisperPortRequest =
  | { type: "prepare"; consented: boolean; language: string }
  | { type: "pcm"; samples: Float32Array }
  | { type: "finish" }
  | { type: "cancel" }
  | { type: "keepalive" };

type ExtensionRuntimePort = Parameters<
  Parameters<typeof browser.runtime.onConnect.addListener>[0]
>[0];

function postPort(port: ExtensionRuntimePort, message: unknown): void {
  try {
    port.postMessage(message);
  } catch {
    return;
  }
}

async function createWhisperPipeline(
  device: "webgpu" | "wasm",
  dtype: "fp16" | "q8",
  onProgress: (progress: unknown) => void,
) {
  const { env, pipeline } = await import("@huggingface/transformers");
  const onnxWasm = env.backends.onnx.wasm;
  if (!onnxWasm) throw new Error("ONNX WASM backend is unavailable");
  onnxWasm.wasmPaths = new URL("onnx/", browser.runtime.getURL("/popup.html")).href;
  env.useBrowserCache = true;
  return pipeline("automatic-speech-recognition", "onnx-community/whisper-base", {
    device,
    dtype,
    progress_callback: onProgress,
  });
}

function validWhisperRequest(value: unknown): value is WhisperPortRequest {
  if (typeof value !== "object" || value === null) return false;
  const type = Reflect.get(value, "type");
  if (type === "prepare") {
    return (
      typeof Reflect.get(value, "consented") === "boolean" &&
      typeof Reflect.get(value, "language") === "string"
    );
  }
  if (type === "pcm") return Reflect.get(value, "samples") instanceof Float32Array;
  return type === "finish" || type === "cancel" || type === "keepalive";
}

export function registerWhisperHost(): void {
  let whisperPipeline: ReturnType<typeof createWhisperPipeline> | null = null;
  let whisperDevice: "webgpu" | "wasm" = "wasm";
  let whisperDtype: "fp16" | "q8" = "q8";

  const loadWhisperPipeline = async (
    port: ExtensionRuntimePort,
  ): Promise<Awaited<ReturnType<typeof createWhisperPipeline>>> => {
    if (!whisperPipeline) {
      const gpu: unknown = Reflect.get(navigator, "gpu");
      const requestAdapter =
        typeof gpu === "object" && gpu !== null ? Reflect.get(gpu, "requestAdapter") : null;
      let hasAdapter = false;
      if (typeof requestAdapter === "function") {
        try {
          hasAdapter = Boolean(await Reflect.apply(requestAdapter, gpu, []));
        } catch {
          hasAdapter = false;
        }
      }
      whisperDevice = hasAdapter ? "webgpu" : "wasm";
      whisperDtype = hasAdapter ? "fp16" : "q8";
      const progress = (event: unknown) => {
        const value =
          typeof event === "object" && event !== null ? Reflect.get(event, "progress") : null;
        const percent = typeof value === "number" && value <= 1 ? value * 100 : value;
        postPort(port, {
          type: "progress",
          value:
            typeof percent === "number" && Number.isFinite(percent) ? Math.round(percent) : null,
        });
      };
      whisperPipeline = createWhisperPipeline(whisperDevice, whisperDtype, progress).catch(
        async () => {
          if (whisperDevice !== "webgpu") throw new Error("Whisper model failed to load");
          whisperDevice = "wasm";
          whisperDtype = "q8";
          return createWhisperPipeline("wasm", "q8", progress);
        },
      );
    }
    let loaded: Awaited<ReturnType<typeof createWhisperPipeline>>;
    try {
      loaded = await whisperPipeline;
    } catch (error) {
      whisperPipeline = null;
      throw error;
    }
    postPort(port, { type: "ready", device: whisperDevice, dtype: whisperDtype });
    return loaded;
  };

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== "frame-notes-whisper") return;
    let language = "english";
    const chunks: Float32Array[] = [];
    let modelPromise: ReturnType<typeof loadWhisperPipeline> | null = null;
    let consented = false;
    let cancelled = false;

    port.onMessage.addListener((value) => {
      if (!validWhisperRequest(value)) return;
      if (value.type === "prepare") {
        if (!value.consented) {
          postPort(port, { type: "error", code: "consent-required" });
          return;
        }
        consented = true;
        language = value.language;
        modelPromise ??= loadWhisperPipeline(port);
        void modelPromise.catch(() => {
          postPort(port, { type: "error", code: "model-load-failed" });
        });
      } else if (value.type === "pcm") {
        if (consented && modelPromise) chunks.push(value.samples);
      } else if (value.type === "finish") {
        const pendingPipeline = modelPromise;
        if (!consented || !pendingPipeline) {
          postPort(port, { type: "error", code: "consent-required" });
          return;
        }
        cancelled = false;
        void (async () => {
          try {
            const transcriber = await pendingPipeline;
            const samples = new Float32Array(
              chunks.reduce((length, chunk) => length + chunk.length, 0),
            );
            let offset = 0;
            for (const chunk of chunks) {
              samples.set(chunk, offset);
              offset += chunk.length;
            }
            chunks.length = 0;
            const result = await transcriber(samples, { language, task: "transcribe" });
            const text = Array.isArray(result) ? result[0]?.text : result.text;
            if (text && !cancelled) postPort(port, { type: "result", text });
          } catch {
            postPort(port, { type: "error", code: "transcription-failed" });
          }
        })();
      } else if (value.type === "cancel") {
        cancelled = true;
        chunks.length = 0;
      }
    });
    port.onDisconnect.addListener(() => {
      chunks.length = 0;
    });
  });
}
