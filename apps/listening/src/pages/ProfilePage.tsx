import { useMemo, useState } from "react";
import { useAppStore } from "../store/AppStore";
import { Avatar, AvatarPicker } from "../components/Avatar";
import { SettingsPage } from "./SettingsPage";
import { ImportPage } from "./ImportPage";
import { useI18n } from "../i18n";
import { MAX_NICKNAME_LENGTH } from "../services/profile";
import {
  computeProfileStats,
  formatScore,
  gameModeLabelKey,
  recentGames,
} from "../utils/profileStats";
import type { TranslationKey } from "../i18n";

interface Props {
  onBack: () => void;
}

type Tab = "profile" | "settings" | "import";

export function ProfilePage({ onBack }: Props) {
  const {
    profile,
    games,
    attempts,
    daily,
    updateNickname,
    selectAvatar,
    uploadAvatar,
  } = useAppStore();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("profile");

  // 統計全部由既有的遊玩紀錄 / 作答紀錄 / 每日挑戰紀錄計算，不另建資料系統。
  const stats = useMemo(
    () => computeProfileStats(games, attempts, daily),
    [games, attempts, daily],
  );
  const recent = useMemo(() => recentGames(games, 10), [games]);

  const [draftName, setDraftName] = useState(profile.nickname);
  const nameLength = draftName.trim().length;
  const nameTooLong = draftName.length > MAX_NICKNAME_LENGTH;

  const saveName = () => {
    updateNickname(draftName);
    setDraftName(profile.nickname === draftName ? draftName : draftName);
  };

  const modeLabel = (mode: string) => t(gameModeLabelKey(mode) as TranslationKey);

  return (
    <div>
      <section className="panel">
        <div className="profile-header">
          <Avatar profile={profile} size={64} />
          <div className="profile-header__text">
            <p className="profile-header__name">{profile.nickname}</p>
            <p className="profile-header__sub">
              {stats.totalGames > 0
                ? `${t("profileGames")} ${formatScore(stats.totalGames)} · ${t("profileTotalScore")} ${formatScore(stats.totalScore)}`
                : t("profileNoGames")}
            </p>
          </div>
        </div>

        <div className="segmented" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="segmented__item"
            aria-pressed={tab === "profile"}
            onClick={() => setTab("profile")}
          >
            {t("profileTabProfile")}
          </button>
          <button
            type="button"
            className="segmented__item"
            aria-pressed={tab === "settings"}
            onClick={() => setTab("settings")}
          >
            {t("profileTabSettings")}
          </button>
          <button
            type="button"
            className="segmented__item"
            aria-pressed={tab === "import"}
            onClick={() => setTab("import")}
          >
            {t("profileTabImport")}
          </button>
        </div>
      </section>

      {tab === "profile" ? (
        <>
          <section className="panel">
            <h2 className="panel__title">{t("profileEditTitle")}</h2>

            <div className="field">
              <span className="field__label">{t("profileNickname")}</span>
              <div className="answer-form" style={{ maxWidth: 360 }}>
                <input
                  className="answer-input"
                  type="text"
                  value={draftName}
                  maxLength={MAX_NICKNAME_LENGTH * 2}
                  aria-label={t("profileNickname")}
                  placeholder={t("profileNicknamePlaceholder")}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveName();
                    }
                  }}
                />
                <button type="button" className="btn btn--primary" onClick={saveName}>
                  {t("profileSave")}
                </button>
              </div>
              <span className="note">
                {`${nameLength}/${MAX_NICKNAME_LENGTH}`}
                {nameTooLong ? ` · ${t("profileNameTooLong")}` : ""}
              </span>
            </div>

            <div className="field">
              <span className="field__label">{t("profileAvatar")}</span>
              <AvatarPicker
                profile={profile}
                onSelect={selectAvatar}
                onUpload={uploadAvatar}
              />
            </div>
          </section>

          <section className="panel">
            <h2 className="panel__title">{t("profileStatsTitle")}</h2>
            <div className="stat-grid">
              <div className="stat">
                <p className="stat__value">{formatScore(stats.totalGames)}</p>
                <p className="stat__label">{t("profileGames")}</p>
              </div>
              <div className="stat">
                <p className="stat__value">{formatScore(stats.totalScore)}</p>
                <p className="stat__label">{t("profileTotalScore")}</p>
              </div>
              <div className="stat">
                <p className="stat__value">{formatScore(stats.bestScore)}</p>
                <p className="stat__label">{t("profileBestScore")}</p>
              </div>
              <div className="stat">
                <p className="stat__value">
                  {stats.lastScore === null ? t("dash") : formatScore(stats.lastScore)}
                </p>
                <p className="stat__label">{t("profileLastScore")}</p>
              </div>
              <div className="stat">
                <p className="stat__value">{formatScore(stats.totalAnswered)}</p>
                <p className="stat__label">{t("profileTotalAnswered")}</p>
              </div>
              <div className="stat">
                <p className="stat__value">{formatScore(stats.totalCorrect)}</p>
                <p className="stat__label">{t("profileTotalCorrect")}</p>
              </div>
              <div className="stat">
                <p className="stat__value">{stats.accuracy}%</p>
                <p className="stat__label">{t("statOverallAccuracy")}</p>
              </div>
              <div className="stat">
                <p className="stat__value">{formatScore(stats.currentStreak)}</p>
                <p className="stat__label">{t("statCurrentStreak")}</p>
              </div>
              <div className="stat">
                <p className="stat__value">{formatScore(stats.bestStreak)}</p>
                <p className="stat__label">{t("statBestStreak")}</p>
              </div>
              <div className="stat">
                <p className="stat__value">{formatScore(stats.totalDailyWins)}</p>
                <p className="stat__label">{t("statDailyWins")}</p>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel__title">{t("profileRecentGames")}</h2>
            {recent.length === 0 ? (
              <p className="note">{t("profileNoGames")}</p>
            ) : (
              <ul>
                {recent.map((game) => (
                  <li key={game.id} className="bar-row">
                    <span className="bar-row__label">
                      {modeLabel(game.gameMode)}
                      <span className="note"> · {game.localDate}</span>
                    </span>
                    <span className="bar-row__value">
                      {formatScore(game.score)}
                      <span className="note">
                        {` · ${t("profileGameDetail", {
                          correct: game.correct,
                          wrong: game.wrong,
                          skipped: game.skipped,
                        })}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {tab === "settings" ? <SettingsPage onBack={onBack} /> : null}
      {tab === "import" ? <ImportPage onBack={onBack} /> : null}

      <div className="btn-row" style={{ marginTop: 4 }}>
        <button type="button" className="btn btn--block" onClick={onBack}>
          {t("profileBackHome")}
        </button>
      </div>
    </div>
  );
}