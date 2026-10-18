import { useI18n } from "../i18n";

interface Props {
  /** 倒數結束的絕對時間戳；null 表示沒有倒數。 */
  deadline: number | null;
  totalMs: number;
  onNext: () => void;
}

/** 複習模式的答案揭示倒數：到 0 自動下一題，也可以隨時手動跳過倒數。 */
export function ReviewCountdown({ deadline, totalMs, onNext }: Props) {
  const { t } = useI18n();
  if (deadline === null) {
    return (
      <button type="button" className="btn btn--primary btn--block" onClick={onNext}>
        {t("nextQuestion")}
      </button>
    );
  }

  return (
    <div>
      <div className="btn-row btn-row--between" style={{ marginBottom: 8 }}>
        <span className="countdown">
          {t("secondsShort", { n: Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) })}
        </span>
        <button type="button" className="btn btn--sm" onClick={onNext}>
          {t("nextQuestion")}
        </button>
      </div>
      <div className="progress-bar-thin">
        <div
          className="progress-bar-thin__fill"
          style={{
            width: `${Math.max(0, Math.min(100, ((deadline - Date.now()) / totalMs) * 100))}%`,
          }}
        />
      </div>
    </div>
  );
}