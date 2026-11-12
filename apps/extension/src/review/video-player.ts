import type { LoopingRange, NoteSession, PlayerCommand, PlayerCommandValue } from "../session";

export interface VideoPlayerAdapter {
  command: (command: PlayerCommand, value?: PlayerCommandValue) => void;
  refresh: () => void;
  dispose: () => void;
}

export function snapTime(time: number, fps: number, duration: number): number {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const safeTime = Number.isFinite(time) ? time : 0;
  const maxTime = Number.isFinite(duration) && duration >= 0 ? duration : 0;
  return Math.min(Math.max(Math.round(safeTime * safeFps) / safeFps, 0), maxTime);
}

export function createVideoPlayerAdapter(
  video: HTMLVideoElement,
  session: NoteSession,
  getFps: () => number,
  onMediaTimeDelta?: (delta: number) => void,
): VideoPlayerAdapter {
  let loopingRange: LoopingRange | null = null;
  let publishFrame = 0;
  let playbackFrame = 0;
  let videoFrameCallback: number | null = null;
  let previousFrame: { mediaTime: number; presentedFrames: number } | null = null;
  let loopWasPaused: boolean | null = null;
  let disposed = false;

  const snap = (time: number) => snapTime(time, getFps(), video.duration);

  const checkLoop = () => {
    if (loopingRange && video.currentTime >= loopingRange.end) {
      video.currentTime = snap(loopingRange.start);
    }
  };

  const stopLoop = (restorePlayback = true) => {
    if (!loopingRange) return;
    const wasPaused = loopWasPaused;
    loopingRange = null;
    loopWasPaused = null;
    if (restorePlayback && wasPaused !== null) {
      if (wasPaused) video.pause();
      else if (video.paused) void video.play().catch(() => undefined);
    }
    schedulePublish();
  };

  const publish = () => {
    if (disposed) return;
    checkLoop();
    const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    session.setPlayerState({
      currentTime: video.paused ? snap(currentTime) : currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      paused: video.paused,
      fps: getFps(),
      loopingRange,
    });
  };

  const schedulePublish = () => {
    if (publishFrame || disposed) return;
    publishFrame = window.requestAnimationFrame(() => {
      publishFrame = 0;
      publish();
    });
  };

  const stopFrameCallbacks = () => {
    if (videoFrameCallback !== null) {
      video.cancelVideoFrameCallback(videoFrameCallback);
      videoFrameCallback = null;
    }
    if (playbackFrame) {
      window.cancelAnimationFrame(playbackFrame);
      playbackFrame = 0;
    }
    if (publishFrame) {
      window.cancelAnimationFrame(publishFrame);
      publishFrame = 0;
    }
    previousFrame = null;
  };

  const requestFrame = () => {
    if (disposed || video.paused) return;
    if (typeof video.requestVideoFrameCallback === "function") {
      if (videoFrameCallback !== null) return;
      videoFrameCallback = video.requestVideoFrameCallback((_, metadata) => {
        videoFrameCallback = null;
        if (disposed) return;
        if (
          previousFrame &&
          metadata.presentedFrames === previousFrame.presentedFrames + 1 &&
          metadata.mediaTime > previousFrame.mediaTime
        ) {
          onMediaTimeDelta?.(metadata.mediaTime - previousFrame.mediaTime);
        }
        previousFrame = {
          mediaTime: metadata.mediaTime,
          presentedFrames: metadata.presentedFrames,
        };
        schedulePublish();
        requestFrame();
      });
      return;
    }
    if (playbackFrame) return;
    playbackFrame = window.requestAnimationFrame(() => {
      playbackFrame = 0;
      checkLoop();
      schedulePublish();
      requestFrame();
    });
  };

  const handlePlay = () => {
    schedulePublish();
    requestFrame();
  };
  const handlePause = () => {
    stopFrameCallbacks();
    if (!video.seeking && !loopingRange && Number.isFinite(video.currentTime)) {
      const snappedTime = snap(video.currentTime);
      if (snappedTime !== video.currentTime) video.currentTime = snappedTime;
    }
    schedulePublish();
  };
  const handleTimeUpdate = () => {
    checkLoop();
    schedulePublish();
  };
  const handleMetadata = () => {
    schedulePublish();
    requestFrame();
  };
  const handleSeeked = () => schedulePublish();

  video.addEventListener("loadedmetadata", handleMetadata);
  video.addEventListener("play", handlePlay);
  video.addEventListener("pause", handlePause);
  video.addEventListener("seeked", handleSeeked);
  video.addEventListener("timeupdate", handleTimeUpdate);
  video.addEventListener("durationchange", handleMetadata);
  schedulePublish();

  const command = (action: PlayerCommand, value?: PlayerCommandValue) => {
    if (disposed) return;
    if (action === "seek" && typeof value === "number") {
      stopLoop();
      video.currentTime = snap(value);
      schedulePublish();
    } else if (action === "pause") {
      stopLoop(false);
      video.pause();
      schedulePublish();
    } else if (action === "loop" && value && typeof value === "object") {
      const start = snap(value.start);
      const end = snap(value.end);
      if (end <= start) return;
      stopLoop();
      loopWasPaused = video.paused;
      loopingRange = { id: value.id, start, end };
      video.currentTime = start;
      void video.play().catch(() => undefined);
      schedulePublish();
    } else if (action === "stopLoop") {
      stopLoop();
    }
  };

  return {
    command,
    refresh: schedulePublish,
    dispose() {
      if (disposed) return;
      disposed = true;
      stopFrameCallbacks();
      video.removeEventListener("loadedmetadata", handleMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleMetadata);
    },
  };
}
