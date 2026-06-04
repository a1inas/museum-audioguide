import { useCallback, useEffect, useRef, useState } from "react";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("Не удалось прочитать аудио"));
    };
    reader.onerror = () => reject(new Error("Ошибка чтения аудио"));
    reader.readAsDataURL(blob);
  });
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/aac",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined;
}

/** iOS often delivers empty blobs unless recording uses a timeslice. */
const RECORDER_TIMESLICE_MS = 250;

type HoldToRecordOptions = {
  onError?: (message: string | null) => void;
  /** Called after mic permission is granted (e.g. pause guide audio). */
  onStreamReady?: () => void;
};

export function useHoldToRecordVoice(options?: HoldToRecordOptions) {
  const onError = options?.onError;
  const onStreamReady = options?.onStreamReady;
  const [voiceDataUrl, setVoiceDataUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const detachListenersRef = useRef<(() => void) | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micHeldRef = useRef(false);
  const stopWhenReadyRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const startingRef = useRef(false);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      stopWhenReadyRef.current = true;
      return;
    }
    stopWhenReadyRef.current = false;
    recorder.stop();
  }, []);

  const beginRecording = useCallback(
    async (streamPromise: Promise<MediaStream>) => {
      if (startingRef.current || recorderRef.current?.state === "recording") {
        return;
      }
      startingRef.current = true;

      try {
        const stream = await streamPromise;
        onStreamReady?.();

        const mimeType = pickRecorderMimeType();
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        streamRef.current = stream;
        recorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          recorderRef.current = null;
          const blobType = recorder.mimeType || mimeType || "audio/mp4";
          const blob = new Blob(chunksRef.current, { type: blobType });
          try {
            const dataUrl = await blobToDataUrl(blob);
            setVoiceDataUrl(dataUrl);
          } catch {
            onError?.("Не удалось сохранить голосовое сообщение.");
          }
          stopTracks();
          clearTimer();
          setIsRecording(false);
        };

        recorder.start(RECORDER_TIMESLICE_MS);
        setIsRecording(true);
        timerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);

        if (stopWhenReadyRef.current || !micHeldRef.current) {
          recorder.stop();
        }
      } catch {
        onError?.("Не удалось получить доступ к микрофону.");
        setIsRecording(false);
        stopTracks();
        clearTimer();
      } finally {
        startingRef.current = false;
      }
    },
    [clearTimer, onError, onStreamReady, stopTracks],
  );

  const releasePointer = useCallback(() => {
    activePointerIdRef.current = null;
    micHeldRef.current = false;
    stopRecording();
  }, [stopRecording]);

  const attachMicButton = useCallback(
    (button: HTMLButtonElement | null) => {
      detachListenersRef.current?.();
      detachListenersRef.current = null;
      if (!button) return;

      const handlePointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        if (activePointerIdRef.current !== null) return;

        event.preventDefault();
        event.stopPropagation();

        activePointerIdRef.current = event.pointerId;
        micHeldRef.current = true;
        stopWhenReadyRef.current = false;

        try {
          button.setPointerCapture(event.pointerId);
        } catch {
          // ignore — capture is best-effort
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          onError?.("На этом устройстве запись голоса не поддерживается.");
          releasePointer();
          return;
        }

        onError?.(null);
        setRecordingSeconds(0);

        // iOS: getUserMedia must be invoked synchronously inside the gesture handler.
        const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
        void beginRecording(streamPromise);
      };

      const handlePointerUp = (event: PointerEvent) => {
        if (activePointerIdRef.current !== event.pointerId) return;
        event.preventDefault();
        try {
          if (button.hasPointerCapture(event.pointerId)) {
            button.releasePointerCapture(event.pointerId);
          }
        } catch {
          // ignore
        }
        releasePointer();
      };

      button.addEventListener("pointerdown", handlePointerDown);
      button.addEventListener("pointerup", handlePointerUp);
      button.addEventListener("pointercancel", handlePointerUp);
      button.addEventListener("lostpointercapture", handlePointerUp);

      detachListenersRef.current = () => {
        button.removeEventListener("pointerdown", handlePointerDown);
        button.removeEventListener("pointerup", handlePointerUp);
        button.removeEventListener("pointercancel", handlePointerUp);
        button.removeEventListener("lostpointercapture", handlePointerUp);
      };
    },
    [beginRecording, onError, releasePointer],
  );

  useEffect(() => {
    return () => {
      detachListenersRef.current?.();
      detachListenersRef.current = null;
      clearTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      stopTracks();
    };
  }, [clearTimer, stopTracks]);

  const formatRecordingTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, []);

  const clearVoice = useCallback(() => {
    setVoiceDataUrl(null);
    onError?.(null);
  }, [onError]);

  return {
    voiceDataUrl,
    setVoiceDataUrl,
    isRecording,
    recordingSeconds,
    clearVoice,
    micButtonRef: attachMicButton,
    formatRecordingTime,
  };
}
