import { currentLocale, type TranslationKey, t } from "../i18n";
import type { DictationController, DictationError, DictationPhase } from "./use-dictation";

interface DictationControlsProps {
  dictation: DictationController;
}

const errorKeys: Record<DictationError, TranslationKey> = {
  dictationUnsupported: "dictationUnsupported",
  dictationPackFailed: "dictationPackFailed",
  dictationPermission: "dictationPermission",
  dictationFailed: "dictationFailed",
  dictationWhisperUnavailable: "dictationWhisperUnavailable",
};

const phaseKeys: Record<DictationPhase, TranslationKey> = {
  idle: "dictationIdle",
  preparing: "dictationPreparing",
  listening: "dictationListening",
  transcribing: "dictationTranscribing",
  "consent-language": "dictationPreparing",
  "consent-model": "dictationPreparing",
  error: "dictationError",
};

export function DictationControls({ dictation }: DictationControlsProps) {
  const locale = currentLocale();
  const { view } = dictation;
  const canStop = view.phase === "listening";
  const canStart = view.phase === "idle" || view.phase === "error";
  const showLocalNotice = view.engine !== null && view.phase !== "idle" && view.phase !== "error";

  return (
    <div
      className="fn-dictation"
      data-world={view.world ?? undefined}
      data-language={view.language ?? undefined}
      data-availability={view.availability ?? undefined}
      data-install-result={view.installResult}
      data-device={view.device ?? undefined}
      data-dtype={view.dtype ?? undefined}
      data-api-supported={view.apiSupported ?? undefined}
      data-probe-results={JSON.stringify(view.probeResults)}
      aria-live="polite"
    >
      <div className="fn-dictation-row">
        <button
          type="button"
          className={`fn-mic-button${canStop ? " fn-mic-button--listening" : ""}`}
          onClick={() => (canStop ? dictation.stop() : dictation.start())}
          disabled={!canStart && !canStop}
          aria-label={t(canStop ? "dictationStop" : "dictationStart", locale)}
          title={t(canStop ? "dictationStop" : "dictationStart", locale)}
        >
          {canStop ? "■" : "🎙"}
        </button>
        <span className="fn-dictation-status">
          {t(view.error ? errorKeys[view.error] : phaseKeys[view.phase], locale)}
        </span>
        {showLocalNotice && (
          <span className="fn-local-audio">{t("dictationAudioLocal", locale)}</span>
        )}
      </div>
      {view.phase === "consent-language" && (
        <div className="fn-dictation-consent">
          <span>
            {t("dictationLanguagePrompt", locale)} ({view.language})
          </span>
          <button type="button" onClick={dictation.installLanguagePack}>
            {t("dictationInstallPack", locale)}
          </button>
        </div>
      )}
      {view.phase === "consent-model" && (
        <div className="fn-dictation-consent">
          <span>
            {t(view.modelConsentRequired ? "dictationModelPrompt" : "dictationModelReady", locale)}
          </span>
          <button type="button" onClick={dictation.consentToWhisper}>
            {t(
              view.modelConsentRequired ? "dictationDownloadModel" : "dictationStartWhisper",
              locale,
            )}
          </button>
        </div>
      )}
      {view.progress !== null && (
        <progress className="fn-dictation-progress" max={100} value={view.progress} />
      )}
      {view.interim && <p className="fn-dictation-interim">{view.interim}</p>}
    </div>
  );
}
