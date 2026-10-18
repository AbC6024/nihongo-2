import {
  AVATAR_ERROR_MESSAGES,
  BUILTIN_AVATARS,
  findAvatar,
  readAndResizeAvatar,
  type AvatarOption,
} from "../services/avatars";
import type { PlayerProfile } from "../services/profile";
import { useI18n, type TranslationKey } from "../i18n";

interface Props {
  profile: PlayerProfile;
  size?: number;
  className?: string;
}

/**
 * 頭像顯示元件。
 * 內建頭像用程式產生的 SVG 繪製；自訂頭像載入失敗時自動退回內建頭像。
 */
export function Avatar({ profile, size = 48, className }: Props) {
  const { t } = useI18n();
  const custom = profile.avatarId === "custom" ? profile.customAvatar : null;

  if (custom) {
    return (
      <img
        className={`avatar${className ? ` ${className}` : ""}`}
        src={custom}
        alt={t("avatarCustom")}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onError={(event) => {
          // 圖片失效時換回內建頭像，避免破圖
          event.currentTarget.style.display = "none";
        }}
        onLoad={(event) => {
          event.currentTarget.style.display = "";
        }}
      />
    );
  }

  const avatar: AvatarOption = findAvatar(profile.avatarId);
  return (
    <span
      className={`avatar avatar--builtin${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size, background: avatar.bg }}
      role="img"
      aria-label={t(profileLabelKey(profile))}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} aria-hidden="true">
        <path d={avatar.path} fill={avatar.fg} />
      </svg>
    </span>
  );
}

function profileLabelKey(profile: PlayerProfile): TranslationKey {
  if (profile.avatarId === "custom") return "avatarCustom";
  const avatar = BUILTIN_AVATARS.find((item) => item.id === profile.avatarId);
  return (avatar?.labelKey as TranslationKey) ?? "avatarDefault";
}

interface PickerProps {
  profile: PlayerProfile;
  onSelect: (avatarId: string) => void;
  onUpload: (dataUrl: string | null) => void;
}

/** 頭像選擇器：內建頭像格 + 自訂圖片上傳。 */
export function AvatarPicker({ profile, onSelect, onUpload }: PickerProps) {
  const { t, locale } = useI18n();

  return (
    <div>
      <div className="avatar-grid">
        {BUILTIN_AVATARS.map((avatar) => {
          const active = profile.avatarId === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              className="avatar-option"
              aria-pressed={active}
              aria-label={t(avatar.labelKey as TranslationKey)}
              title={t(avatar.labelKey as TranslationKey)}
              style={{ background: avatar.bg }}
              onClick={() => onSelect(avatar.id)}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                <path d={avatar.path} fill={avatar.fg} />
              </svg>
            </button>
          );
        })}
      </div>

      <label className="btn btn--sm" style={{ marginTop: 10, display: "inline-flex" }}>
        {t("avatarUpload")}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="visually-hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            void (async () => {
              const result = await readAndResizeAvatar(file);
              if (result.ok && result.dataUrl) {
                onUpload(result.dataUrl);
                return;
              }
              const key =
                locale === "ja" ? "ja" : locale === "en" ? "en" : "zhTW";
              const message = AVATAR_ERROR_MESSAGES[result.error ?? "avatarReadError"];
              window.alert(message ? message[key] : t("avatarReadError"));
            })();
          }}
        />
      </label>

      {profile.customAvatar ? (
        <button
          type="button"
          className="btn btn--sm btn--danger"
          style={{ marginLeft: 8 }}
          onClick={() => onUpload(null)}
        >
          {t("avatarRemoveCustom")}
        </button>
      ) : null}
    </div>
  );
}