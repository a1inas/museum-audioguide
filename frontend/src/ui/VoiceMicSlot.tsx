import { MicOutlineIcon } from "./MicOutlineIcon";
import { TrashOutlineIcon } from "./TrashOutlineIcon";

type VoiceMicSlotProps = {
  isRecording: boolean;
  hasVoice: boolean;
  disabled?: boolean;
  onClear: () => void;
  micButtonRef: (node: HTMLButtonElement | null) => void;
  wrapClassName?: string;
};

/** Mic / trash controls shared by feedback form and point review. */
export function VoiceMicSlot({
  isRecording,
  hasVoice,
  disabled = false,
  onClear,
  micButtonRef,
  wrapClassName = "",
}: VoiceMicSlotProps) {
  if (hasVoice && !isRecording) {
    return (
      <button
        type="button"
        className="point-review-button point-review-button--ghost point-review-inline-delete"
        onClick={onClear}
        onContextMenu={(event) => event.preventDefault()}
        aria-label="Удалить голос"
        disabled={disabled}
        style={{ width: 46, height: 46, padding: 0, justifyContent: "center" }}
      >
        <TrashOutlineIcon className="point-review-delete-icon" />
      </button>
    );
  }

  return (
    <div className={"point-review-mic-wrap" + wrapClassName}>
      <button
        ref={micButtonRef}
        type="button"
        className={
          "point-review-mic-button" +
          (isRecording ? " point-review-mic-button--recording" : "")
        }
        aria-label="Удерживайте для записи"
        disabled={disabled}
        onContextMenu={(event) => event.preventDefault()}
        style={{ border: "1px solid rgba(152, 110, 60, 0.42)" }}
      >
        <MicOutlineIcon className="point-review-mic-icon" />
      </button>
      <div className="point-review-mic-tooltip" role="tooltip">
        {isRecording
          ? "Запись идет, пока вы держите кнопку"
          : "Удерживайте кнопку для записи"}
      </div>
    </div>
  );
}
