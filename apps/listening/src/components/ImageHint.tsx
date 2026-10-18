import { useEffect, useState } from "react";
import type { ImageMode, Question } from "../types/question";
import { imageAltText, imageAttribution, resolveImageUrl } from "../services/imageMatcher";
import { useI18n } from "../i18n";

interface Props {
  question: Question;
  mode: ImageMode;
}

/**
 * 圖片提示區。
 * 沒有圖片或載入失敗時不中斷遊戲：前者完全不渲染，後者顯示簡潔 placeholder。
 */
export function ImageHint({ question, mode }: Props) {
  const { t } = useI18n();
  const url = resolveImageUrl(question, mode);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url) return null;
  const attribution = imageAttribution(question);

  return (
    <div className="image-hint">
      {failed ? (
        <p className="note">{t("imageLoadFailed")}</p>
      ) : (
        <img src={url} alt={imageAltText(question)} loading="lazy" onError={() => setFailed(true)} />
      )}
      {attribution ? (
        <p className="image-hint__caption">{t("imageAttribution", { source: attribution })}</p>
      ) : null}
    </div>
  );
}