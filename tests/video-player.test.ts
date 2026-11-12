import { afterEach, describe, expect, it, vi } from "vitest";
import { createVideoPlayerAdapter } from "../apps/extension/src/review/video-player";
import type { NoteSession } from "../apps/extension/src/session";

class FakeVideo {
  duration = 10;
  paused = false;
  seeking = false;
  pendingTime: number | null = null;
  private current = 1.304;
  private listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  get currentTime(): number {
    return this.current;
  }

  set currentTime(value: number) {
    this.pendingTime = value;
    this.seeking = true;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.get(type)?.delete(listener);
  }

  pause(): void {
    this.paused = true;
    this.dispatch("pause");
  }

  play(): Promise<void> {
    this.paused = false;
    this.dispatch("play");
    return Promise.resolve();
  }

  private dispatch(type: string): void {
    const event = new Event(type);
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === "function") listener(event);
      else listener.handleEvent(event);
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("video player adapter", () => {
  it("snaps paused time and publishes the snapped value before seeking completes", () => {
    let nextFrameId = 0;
    const frames = new Map<number, FrameRequestCallback>();
    vi.stubGlobal("window", {
      requestAnimationFrame(callback: FrameRequestCallback) {
        const id = ++nextFrameId;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame(id: number) {
        frames.delete(id);
      },
    });

    const flushAnimationFrame = () => {
      const pendingFrames = [...frames.entries()];
      frames.clear();
      for (const [, callback] of pendingFrames) callback(0);
    };
    const video = new FakeVideo();
    const setPlayerState = vi.fn();
    const session = { setPlayerState } as unknown as NoteSession;
    const adapter = createVideoPlayerAdapter(
      video as unknown as HTMLVideoElement,
      session,
      () => 25,
    );

    flushAnimationFrame();
    expect(setPlayerState).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentTime: 1.304, paused: false }),
    );
    expect(video.pendingTime).toBeNull();

    adapter.command("pause");
    expect(video.pendingTime).toBeCloseTo(1.32);
    expect(video.currentTime).toBe(1.304);
    flushAnimationFrame();
    expect(setPlayerState).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentTime: 1.32, paused: true }),
    );

    adapter.dispose();
  });
});
