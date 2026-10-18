import { useI18n } from "../i18n";

interface Props {
  starred: boolean;
  onToggle: () => void;
  label?: string;
}

export function StarButton({ starred, onToggle, label }: Props) {
  const { t } = useI18n();
  const text = starred ? t("starOff") : t("starOn");
  return (
    <button
      type="button"
      className="star-btn"
      data-starred={starred}
      onClick={onToggle}
      aria-pressed={starred}
      title={text}
      aria-label={text}
    >
      {starred ? "★" : "☆"}
      {label ? <span className="visually-hidden">{label}</span> : null}
    </button>
  );
}