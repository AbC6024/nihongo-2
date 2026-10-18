import { useRef, useState } from "react";
import { useAppStore } from "../store/AppStore";
import { importVocabulary, type ImportReport } from "../services/vocabularyImporter";
import { useI18n } from "../i18n";

interface Props {
  onBack: () => void;
}

const CSV_TEMPLATE = `id,japanese,kana,romaji,meaning,difficulty,script,category,partOfSpeech
sample-uma,馬,うま,uma,馬,N5,hiragana,動物與自然生態,名詞
sample-kaigi,会議,かいぎ,kaigi,會議,N4,mixed,學校與工作,名詞`;

export function ImportPage({ onBack }: Props) {
  const { customWords, addCustomWords, clearCustomWords } = useAppStore();
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runImport = (content: string) => {
    const result = importVocabulary(content, customWords);
    setReport(result);
  };

  return (
    <div>
      <div className="banner banner--info">{t("importIntro")}</div>

      <section className="panel">
        <h2 className="panel__title">{t("importStep1")}</h2>
        <textarea
          className="textarea"
          value={text}
          spellCheck={false}
          placeholder='[{"japanese":"猫","kana":"ねこ","romaji":"neko","meaning":"貓","difficulty":"N5","category":"動物"}]'
          onChange={(event) => {
            setText(event.target.value);
            setReport(null);
          }}
        />
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => runImport(text)}
            disabled={!text.trim()}
          >
            {t("importCheck")}
          </button>
          <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()}>
            {t("importChooseFile")}
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              setText(CSV_TEMPLATE);
              setReport(null);
            }}
          >
            {t("importCsvSample")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="visually-hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const content = await file.text();
              setText(content);
              runImport(content);
              event.target.value = "";
            }}
          />
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          {t("importSampleLink")}
          <a href="./data/vocabulary.sample.json" target="_blank" rel="noreferrer">
            /data/vocabulary.sample.json
          </a>
        </p>
      </section>

      <section className="panel">
        <h2 className="panel__title">{t("importStep2")}</h2>
        {report ? (
          <>
            <div className="stat-grid">
              <div className="stat">
                <p className="stat__value">{report.total}</p>
                <p className="stat__label">{t("reportTotal")}</p>
              </div>
              <div className="stat">
                <p className="stat__value">{report.imported}</p>
                <p className="stat__label">{t("reportSuccess")}</p>
              </div>
              <div className="stat">
                <p className="stat__value">{report.skipped}</p>
                <p className="stat__label">{t("reportSkipped")}</p>
              </div>
              <div className="stat">
                <p className="stat__value">{report.duplicates.length}</p>
                <p className="stat__label">{t("reportDuplicates")}</p>
              </div>
            </div>
            {report.issues.length > 0 ? (
              <>
                <p className="field__label">{t("errorRows")}</p>
                <pre className="report">
                  {report.issues.map((issue) => `${issue.line}: ${issue.reason}`).join("\n")}
                </pre>
              </>
            ) : null}
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={report.result.length === 0}
                onClick={() => {
                  addCustomWords(report.result);
                  setText("");
                  setReport(null);
                }}
              >
                {t("importConfirmAdd", { n: report.result.length })}
              </button>
            </div>
          </>
        ) : (
          <p className="note">{t("importEmptyReport")}</p>
        )}
      </section>

      <section className="panel">
        <h2 className="panel__title">{t("importStep3", { n: customWords.length })}</h2>
        {customWords.length === 0 ? (
          <p className="note">{t("customWordsEmpty")}</p>
        ) : (
          <>
            <p className="note">{t("customWordsFirst20")}</p>
            <ul className="note">
              {customWords.slice(0, 20).map((word) => (
                <li key={word.id}>
                  {word.japanese}（{word.kana}／{word.romaji}）· {word.difficulty} ·{" "}
                  {word.category}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={() => {
                if (window.confirm(t("confirmRemoveCustom"))) {
                  clearCustomWords();
                }
              }}
            >
              {t("removeAllCustom")}
            </button>
          </>
        )}
      </section>

      <button type="button" className="btn btn--block" onClick={onBack}>
        {t("returnBtn")}
      </button>
    </div>
  );
}