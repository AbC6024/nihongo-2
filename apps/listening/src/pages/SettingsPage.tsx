import { useRef, useState } from "react";
import { useAppStore } from "../store/AppStore";
import {
  DIFFICULTY_ORDER,
  DURATION_VALUES,
  IMAGE_MODE_VALUES,
  INPUT_METHOD_VALUES,
  REVIEW_REVEAL_SECONDS,
} from "../utils/settings";
import { describeStorageUsage, STORAGE_SCHEMA_VERSION } from "../services/storage";
import { downloadBackupFile, parseBackup } from "../services/backup";
import { toLocalDateKey } from "../utils/date";
import { getSpeechAvailability } from "../services/speech";
import {
  TTS_PREFERRED_MAX,
  TTS_PREFERRED_MIN,
  DEFAULT_SPEECH_RATE_CONFIG,
  SPEECH_SPEED_MULTIPLIERS,
  speechSpeedLabel,
} from "../utils/speechRate";
import type { GameDuration, InputMethod } from "../types/game";
import type { ImageMode } from "../types/question";
import { useI18n, LOCALE_DURATION, LOCALE_INPUT_METHOD, type TranslationKey } from "../i18n";

interface Props {
  onBack: () => void;
}

const IMAGE_MODE_KEYS: Record<ImageMode, TranslationKey> = {
  local: "imageModeLocal",
  remote: "imageModeRemote",
  disabled: "imageModeDisabled",
};

export function SettingsPage({ onBack }: Props) {
  const { settings, updateSettings, storageWarning, resetEverything, exportBackup, importBackup } =
    useAppStore();
  const { t, locale } = useI18n();
  const [confirmReset, setConfirmReset] = useState(false);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [backupMessage, setBackupMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usage = describeStorageUsage();
  const availability = getSpeechAvailability();
  const durationLabel = LOCALE_DURATION[locale];
  const inputLabels = LOCALE_INPUT_METHOD[locale];

  return (
    <div>
      {storageWarning ? <div className="banner banner--warn">{t("storageWarning")}</div> : null}

      <section className="panel">
        <h2 className="panel__title">{t("sectionPlay")}</h2>

        <div className="field">
          <span className="field__label">{t("labelDefaultDuration")}</span>
          <div className="segmented">
            {DURATION_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                className="segmented__item"
                aria-pressed={settings.duration === value}
                onClick={() => updateSettings({ duration: value as GameDuration })}
              >
                {durationLabel(value / 60)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">{t("labelDefaultInputMethod")}</span>
          <div className="segmented">
            {INPUT_METHOD_VALUES.map((method) => (
              <button
                key={method}
                type="button"
                className="segmented__item"
                aria-pressed={settings.inputMethod === method}
                onClick={() => updateSettings({ inputMethod: method as InputMethod })}
              >
                {inputLabels[method]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">{t("labelDefaultDifficulty")}</span>
          <div className="chip-set">
            {DIFFICULTY_ORDER.map((difficulty) => {
              const active = settings.difficulties.includes(difficulty);
              return (
                <button
                  key={difficulty}
                  type="button"
                  className="chip"
                  style={{
                    background: active ? "var(--accent)" : "var(--surface)",
                    color: active ? "#fff" : "var(--ink-soft)",
                    borderColor: active ? "var(--accent)" : "var(--line)",
                  }}
                  aria-pressed={active}
                  onClick={() => {
                    const next = settings.difficulties.includes(difficulty)
                      ? settings.difficulties.filter((item) => item !== difficulty)
                      : [...settings.difficulties, difficulty];
                    updateSettings({ difficulties: next.length > 0 ? next : [difficulty] });
                  }}
                >
                  {difficulty}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title">{t("sectionSpeechRate")}</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.shortWordSlowSpeech}
            onChange={(event) => updateSettings({ shortWordSlowSpeech: event.target.checked })}
          />
          {t("toggleShortWordSlow")}
        </label>
        <div className="field">
          <span className="field__label">
            {t("shortWordMoraHint", { n: settings.shortWordMaxMora })}
          </span>
          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={settings.shortWordMaxMora}
            disabled={!settings.shortWordSlowSpeech}
            onChange={(event) => updateSettings({ shortWordMaxMora: Number(event.target.value) })}
          />
        </div>
        <div className="field">
          <span className="field__label">
            {t("shortWordMultiplierHint", { n: settings.shortWordRateMultiplier })}
          </span>
          <input
            type="range"
            min={TTS_PREFERRED_MIN}
            max={1}
            step={0.05}
            value={settings.shortWordRateMultiplier}
            disabled={!settings.shortWordSlowSpeech}
            onChange={(event) =>
              updateSettings({ shortWordRateMultiplier: Number(event.target.value) })
            }
          />
        </div>
        <div className="field">
          <span className="field__label">{t("speechBaseRateHint", { n: settings.speechBaseRate })}</span>
          <input
            type="range"
            min={TTS_PREFERRED_MIN}
            max={TTS_PREFERRED_MAX}
            step={0.05}
            value={settings.speechBaseRate}
            onChange={(event) => updateSettings({ speechBaseRate: Number(event.target.value) })}
          />
        </div>
        <div className="field">
          <span className="field__label">{t("speechSpeedLabel")}</span>
          <div className="segmented" role="group" aria-label={t("speechSpeedLabel")}>
            {SPEECH_SPEED_MULTIPLIERS.map((speed) => (
              <button
                key={speed}
                type="button"
                className="segmented__item"
                aria-pressed={settings.speechSpeed === speed}
                onClick={() => updateSettings({ speechSpeed: speed })}
              >
                {speed === 1 ? t("speechSpeedNormal") : t("speechSpeedSlow")}（{speechSpeedLabel(speed)}）
              </button>
            ))}
          </div>
          <p className="note" style={{ marginTop: 6 }}>
            {t("speechSpeedHint")}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() =>
            updateSettings({
              shortWordSlowSpeech: DEFAULT_SPEECH_RATE_CONFIG.shortWordSlowSpeech,
              speechBaseRate: DEFAULT_SPEECH_RATE_CONFIG.baseRate,
              shortWordMaxMora: DEFAULT_SPEECH_RATE_CONFIG.shortWordMaxMora,
              shortWordRateMultiplier: DEFAULT_SPEECH_RATE_CONFIG.shortWordRateMultiplier,
              speechSpeed: DEFAULT_SPEECH_RATE_CONFIG.speedMultiplier,
            })
          }
        >
          {t("resetSpeechRate")}
        </button>
        <p className="note" style={{ marginTop: 8 }}>
          {t("accentNote")}
        </p>
      </section>

      <section className="panel">
        <h2 className="panel__title">{t("sectionTiming")}</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showImageHintDuringPlay}
            onChange={(event) => updateSettings({ showImageHintDuringPlay: event.target.checked })}
          />
          {t("toggleImageHint")}
        </label>
        <div className="field">
          <span className="field__label">
            {t("revealCorrectTime", { n: settings.revealCorrectMs })}
          </span>
          <input
            type="range"
            min={300}
            max={3000}
            step={100}
            value={settings.revealCorrectMs}
            onChange={(event) => updateSettings({ revealCorrectMs: Number(event.target.value) })}
          />
        </div>
        <div className="field">
          <span className="field__label">{t("revealSkipTime", { n: settings.revealSkipMs })}</span>
          <input
            type="range"
            min={300}
            max={3000}
            step={100}
            value={settings.revealSkipMs}
            onChange={(event) => updateSettings({ revealSkipMs: Number(event.target.value) })}
          />
        </div>
        <p className="note">{t("reviewFixedNote", { n: REVIEW_REVEAL_SECONDS })}</p>
      </section>

      <section className="panel">
        <h2 className="panel__title">{t("sfxSection")}</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.sfxEnabled}
            onChange={(event) => updateSettings({ sfxEnabled: event.target.checked })}
          />
          {t("sfxToggle")}
        </label>
        <p className="note">{t("sfxToggleHint")}</p>
        <div className="field">
          <span className="field__label">
            {t("sfxVolume", { n: Math.round(settings.sfxVolume * 100) })}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.sfxVolume}
            disabled={!settings.sfxEnabled}
            onChange={(event) => updateSettings({ sfxVolume: Number(event.target.value) })}
          />
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title">{t("sectionAudio")}</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.useAudioFiles}
            onChange={(event) => updateSettings({ useAudioFiles: event.target.checked })}
          />
          {t("toggleAudioFiles")}
        </label>
        <div className="field">
          <span className="field__label">{t("labelImageMode")}</span>
          <div className="segmented">
            {IMAGE_MODE_VALUES.map((mode) => (
              <button
                key={mode}
                type="button"
                className="segmented__item"
                aria-pressed={settings.imageMode === mode}
                onClick={() => updateSettings({ imageMode: mode })}
              >
                {t(IMAGE_MODE_KEYS[mode])}
              </button>
            ))}
          </div>
        </div>
        <p className="note">
          {availability.ttsSupported
            ? availability.jaVoiceAvailable
              ? t("voiceAvailable")
              : t("voiceUnavailable")
            : t("ttsUnsupported")}
        </p>
        <p className="note">{t("accentNote")}</p>
      </section>

      <section className="panel">
        <h2 className="panel__title">{t("backupSection")}</h2>
        <p className="note">{t("backupIntro")}</p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              const content = exportBackup();
              const name = `niiki-board-backup-${toLocalDateKey()}.json`;
              const ok = content && downloadBackupFile(name, content);
              setBackupMessage(
                ok
                  ? { ok: true, text: t("backupExported", { name }) }
                  : { ok: false, text: t("backupExportFailed") },
              );
            }}
          >
            {t("backupExport")}
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => fileInputRef.current?.click()}
          >
            {t("backupImport")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="visually-hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) {
                setBackupMessage({ ok: false, text: t("backupNeedFile") });
                return;
              }
              const parsed = parseBackup(await file.text());
              if (!parsed.ok || !parsed.data) {
                setBackupMessage({
                  ok: false,
                  text: t("backupImportFailed", { error: parsed.error ?? "unknown" }),
                });
                return;
              }
              const summary = importBackup(parsed.data, importMode);
              setBackupMessage({
                ok: true,
                text: t("backupImportOk", {
                  mistakes: summary.mistakes,
                  attempts: summary.attempts,
                  games: summary.games,
                  days: summary.completedDates,
                }),
              });
            }}
          />
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <span className="field__label">{t("backupMerge")}</span>
          <div className="segmented">
            <button
              type="button"
              className="segmented__item"
              aria-pressed={importMode === "merge"}
              onClick={() => setImportMode("merge")}
            >
              {t("backupMerge")}
            </button>
            <button
              type="button"
              className="segmented__item"
              aria-pressed={importMode === "replace"}
              onClick={() => setImportMode("replace")}
            >
              {t("backupReplace")}
            </button>
          </div>
        </div>
        {backupMessage ? (
          <div className={`banner ${backupMessage.ok ? "banner--info" : "banner--warn"}`}>
            {backupMessage.text}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2 className="panel__title">{t("sectionData")}</h2>
        <p className="note">
          {t("dataNote", {
            version: STORAGE_SCHEMA_VERSION,
            size: (usage.totalBytes / 1024).toFixed(1),
          })}
        </p>
        <ul className="note">
          {usage.keys.map((item) => (
            <li key={item.key}>
              {item.key}：{(item.bytes / 1024).toFixed(1)} KB
            </li>
          ))}
        </ul>
        {confirmReset ? (
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={() => {
                resetEverything();
                setConfirmReset(false);
              }}
            >
              {t("confirmClearAllData")}
            </button>
            <button type="button" className="btn btn--sm" onClick={() => setConfirmReset(false)}>
              {t("cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--sm btn--danger"
            onClick={() => setConfirmReset(true)}
          >
            {t("clearAllData")}
          </button>
        )}
      </section>

      <button type="button" className="btn btn--block" onClick={onBack}>
        {t("returnBtn")}
      </button>
    </div>
  );
}