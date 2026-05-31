import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type TouchEvent,
} from "react";

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

const isTouchLikeDevice =
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

type HoldToRecordOptions = {
  onError?: (message: string | null) => void;
  /** Called when the user presses the mic (e.g. pause other audio on the page). */
  onPressStart?: () => void;
};

export function useHoldToRecordVoice(options?: HoldToRecordOptions) {
  const onError = options?.onError;
  const onPressStartExtra = options?.onPressStart;
  const [voiceDataUrl, setVoiceDataUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micHeldRef = useRef(false);
  const stopWhenReadyRef = useRef(false);
  const touchPressRef = useRef(false);

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

  const startRecording = useCallback(async () => {
    if (recorderRef.current?.state === "recording") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.("На этом устройстве запись голоса не поддерживается.");
      return;
    }

    onError?.(null);
    setRecordingSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
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
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
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

      recorder.start();
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
    }
  }, [clearTimer, onError, stopTracks]);

  const onPressStart = useCallback(() => {
    micHeldRef.current = true;
    stopWhenReadyRef.current = false;
    onPressStartExtra?.();
    if (recorderRef.current?.state !== "recording") {
      void startRecording();
    }
  }, [onPressStartExtra, startRecording]);

  const onPressEnd = useCallback(() => {
    micHeldRef.current = false;
    stopRecording();
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      clearTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      stopTracks();
    };
  }, [clearTimer, stopTracks]);

  const bindMicButton = useCallback(() => {
    const pointerHandlers = isTouchLikeDevice
      ? {}
      : {
          onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            onPressStart();
          },
          onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            onPressEnd();
          },
          onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            onPressEnd();
          },
        };

    const touchHandlers = isTouchLikeDevice
      ? {
          onTouchStart: (event: TouchEvent<HTMLButtonElement>) => {
            event.preventDefault();
            touchPressRef.current = true;
            onPressStart();
          },
          onTouchEnd: (event: TouchEvent<HTMLButtonElement>) => {
            event.preventDefault();
            if (!touchPressRef.current) return;
            touchPressRef.current = false;
            onPressEnd();
          },
          onTouchCancel: (event: TouchEvent<HTMLButtonElement>) => {
            event.preventDefault();
            touchPressRef.current = false;
            onPressEnd();
          },
        }
      : {};

    return {
      ...pointerHandlers,
      ...touchHandlers,
      onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) =>
        event.preventDefault(),
    };
  }, [onPressEnd, onPressStart]);

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
    bindMicButton,
    formatRecordingTime,
  };
}
