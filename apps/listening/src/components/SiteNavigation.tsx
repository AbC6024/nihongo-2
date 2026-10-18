import { useI18n } from "../i18n";

const SITE_COPY = {
  "zh-TW": {
    navigation: "全站導覽",
    brand: "遊戲學日語",
    home: "首頁",
    particles: "助詞大冒險",
    kana: "五十音",
    verbs: "動詞活用",
    listening: "聽打練習",
    localProgress: "聽打紀錄保存在此瀏覽器，不會自動同步到其他裝置。",
    sources: "資料來源與授權",
  },
  ja: {
    navigation: "サイトナビゲーション",
    brand: "遊戲學日語",
    home: "ホーム",
    particles: "助詞大冒險",
    kana: "五十音",
    verbs: "動詞活用",
    listening: "聞き取り練習",
    localProgress: "聞き取りの学習記録はこのブラウザーに保存され、他の端末には自動同期されません。",
    sources: "データの出典・ライセンス",
  },
  en: {
    navigation: "Site navigation",
    brand: "遊戲學日語",
    home: "Home",
    particles: "Particles",
    kana: "Kana",
    verbs: "Verb forms",
    listening: "Listening",
    localProgress: "Listening progress is saved in this browser and does not automatically sync across devices.",
    sources: "Data sources and licenses",
  },
};

export function SiteNavigation({ onOpenListening }: { onOpenListening: () => void }) {
  const { locale } = useI18n();
  const copy = SITE_COPY[locale];
  const links = [
    { href: "../index.html", label: copy.home },
    { href: "../particles.html", label: copy.particles },
    { href: "../gojuon.html", label: copy.kana },
    { href: "../conjugation.html", label: copy.verbs },
  ];

  return (
    <header className="learning-site-header">
      <div className="learning-site-header__inner">
        <a className="learning-site-brand" href="../index.html">
          <span className="learning-site-brand__mark" aria-hidden="true">日</span>
          <span>{copy.brand}<small>NIHONGO GAMES</small></span>
        </a>
        <nav className="learning-site-nav" aria-label={copy.navigation}>
          {links.map((link) => (
            <a key={link.href} href={link.href}>{link.label}</a>
          ))}
          <a
            href="#/home"
            aria-current="page"
            onClick={(event) => {
              event.preventDefault();
              onOpenListening();
            }}
          >
            {copy.listening}
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { locale, t } = useI18n();
  const copy = SITE_COPY[locale];

  return (
    <footer className="learning-site-footer">
      <p>{copy.localProgress}</p>
      <p>{t("machineVoiceNote")}</p>
      <a href="./DATA_SOURCE.md">{copy.sources}</a>
    </footer>
  );
}
