"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

interface YouTubePlayer {
  destroy(): void;
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
}

interface YouTubePlayerEvent {
  target: YouTubePlayer;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width: string;
      height: string;
      host: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: YouTubePlayerEvent) => void;
        onError: () => void;
      };
    }
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube player API did not initialize."));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube player API could not be loaded."));
    document.head.appendChild(script);
  });

  return apiPromise;
}

export interface YouTubePreviewHandle {
  seekTo(time: number): void;
}

interface YouTubePreviewProps {
  videoId: string;
  onTimeUpdate(time: number): void;
  onReady(): void;
  onError(): void;
}

const YouTubePreview = forwardRef<YouTubePreviewHandle, YouTubePreviewProps>(
  function YouTubePreview({ videoId, onTimeUpdate, onReady, onError }, ref) {
    const mountRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YouTubePlayer | null>(null);

    useImperativeHandle(ref, () => ({
      seekTo(time) {
        playerRef.current?.seekTo(time, true);
      },
    }));

    useEffect(() => {
      let active = true;
      let timer: number | null = null;

      loadYouTubeApi()
        .then((YT) => {
          if (!active || !mountRef.current) return;
          playerRef.current = new YT.Player(mountRef.current, {
            videoId,
            width: "100%",
            height: "100%",
            host: "https://www.youtube-nocookie.com",
            playerVars: {
              controls: 1,
              playsinline: 1,
              rel: 0,
              origin: window.location.origin,
            },
            events: {
              onReady(event) {
                if (!active) return;
                playerRef.current = event.target;
                onReady();
                timer = window.setInterval(() => {
                  const current = playerRef.current?.getCurrentTime();
                  if (typeof current === "number" && Number.isFinite(current)) {
                    onTimeUpdate(current);
                  }
                }, 250);
              },
              onError() {
                if (active) onError();
              },
            },
          });
        })
        .catch(() => {
          if (active) onError();
        });

      return () => {
        active = false;
        if (timer) window.clearInterval(timer);
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    }, [videoId, onError, onReady, onTimeUpdate]);

    return (
      <div
        ref={mountRef}
        className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full"
      />
    );
  }
);

export default YouTubePreview;
