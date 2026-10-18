import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AppStoreProvider, useAppStore } from "./store/AppStore";
import { HomePage } from "./pages/HomePage";
import { PlayPage } from "./pages/PlayPage";
import { ReviewPage } from "./pages/ReviewPage";
import { DailyPage } from "./pages/DailyPage";
import { MistakesPage } from "./pages/MistakesPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ImportPage } from "./pages/ImportPage";
import { ProfilePage } from "./pages/ProfilePage";
import { I18nProvider, useI18n } from "./i18n";
import { BRAND_TITLE } from "./i18n/brand";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { SiteNavigation, SiteFooter } from "./components/SiteNavigation";
import type { LocaleCode } from "./types/game";
import "./styles.css";
import "./site-theme.css";

export type Route =
  | { name: "home" }
  | { name: "word" }
  | { name: "sentence" }
  | { name: "review" }
  | { name: "reviewMistakes" }
  | { name: "mistakes" }
  | { name: "daily" }
  | { name: "analytics" }
  | { name: "settings" }
  | { name: "import" }
  | { name: "profile" };

const ROUTE_NAMES: Route["name"][] = [
  "home",
  "word",
  "sentence",
  "review",
  "reviewMistakes",
  "mistakes",
  "daily",
  "analytics",
  "settings",
  "import",
  "profile",
];

function routeToHash(route: Route): string {
  return `#/${route.name}`;
}

function hashToRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, "") as Route["name"];
  return ROUTE_NAMES.includes(name) ? { name } : { name: "home" };
}

/**
 * 語言橋接：從遊戲設定讀取語言，並在切換時寫回設定。
 * 因為語言存在 settings（localStorage），重新整理後會沿用上次選擇，
 * 切換語言也不會動到錯題本、遊玩紀錄或其他設定。
 */
function I18nBridge({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useAppStore();
  const setLocale = useCallback(
    (locale: LocaleCode) => updateSettings({ language: locale }),
    [updateSettings],
  );
  return (
    <I18nProvider locale={settings.language} onLocaleChange={setLocale}>
      {children}
    </I18nProvider>
  );
}

function Shell() {
  const { storageWarning } = useAppStore();
  const { t } = useI18n();
  const [route, setRoute] = useState<Route>(() => hashToRoute(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(hashToRoute(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    setRoute(next);
    const hash = routeToHash(next);
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
    window.scrollTo({ top: 0 });
  }, []);

  const goHome = useCallback(() => navigate({ name: "home" }), [navigate]);
  const startReview = useCallback(() => navigate({ name: "review" }), [navigate]);

  const narrow =
    route.name !== "home" &&
    route.name !== "analytics" &&
    route.name !== "mistakes";

  return (
    <div className="app">
      <SiteNavigation onOpenListening={goHome} />
      <header className="topbar">
        {route.name !== "home" ? (
          <button type="button" className="topbar__back" onClick={goHome}>
            {t("back")}
          </button>
        ) : null}
        <h1 className="topbar__title">{BRAND_TITLE}</h1>
        <span className="topbar__spacer" />
        <LanguageSwitcher />
      </header>

      <nav className="listening-tools" aria-label={t("settingsAndData")}>
        <a
          href="#/home"
          aria-current={route.name === "home" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            goHome();
          }}
        >
          {BRAND_TITLE}
        </a>
        <a
          href="#/settings"
          aria-current={route.name === "settings" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            navigate({ name: "settings" });
          }}
        >
          {t("gameSettings")}
        </a>
        <a
          href="#/import"
          aria-current={route.name === "import" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            navigate({ name: "import" });
          }}
        >
          {t("profileTabImport")}
        </a>
      </nav>

      <main className={`page${narrow ? " page--narrow" : ""}`}>
        {storageWarning ? <div className="banner banner--warn">{t("storageWarning")}</div> : null}

        {route.name === "home" ? (
          <HomePage
            onStartWord={() => navigate({ name: "word" })}
            onStartSentence={() => navigate({ name: "sentence" })}
            onStartReview={startReview}
            onOpenMistakes={() => navigate({ name: "mistakes" })}
            onOpenDaily={() => navigate({ name: "daily" })}
            onOpenAnalytics={() => navigate({ name: "analytics" })}
            onOpenProfile={() => navigate({ name: "profile" })}
          />
        ) : null}

        {route.name === "word" ? (
          <PlayPage
            key="word"
            mode="word"
            onExit={goHome}
            onReview={() => navigate({ name: "reviewMistakes" })}
          />
        ) : null}

        {route.name === "sentence" ? (
          <PlayPage
            key="sentence"
            mode="sentence"
            onExit={goHome}
            onReview={() => navigate({ name: "reviewMistakes" })}
          />
        ) : null}

        {route.name === "review" ? (
          <ReviewPage key="review" onExit={goHome} />
        ) : null}

        {route.name === "reviewMistakes" ? (
          <ReviewPage key="reviewMistakes" mistakesOnly onExit={goHome} />
        ) : null}

        {route.name === "mistakes" ? (
          <MistakesPage onStartReview={startReview} onBack={goHome} />
        ) : null}

        {route.name === "daily" ? (
          <DailyPage key="daily" onExit={goHome} />
        ) : null}

        {route.name === "analytics" ? (
          <AnalyticsPage onOpenMistakes={() => navigate({ name: "mistakes" })} />
        ) : null}

        {route.name === "settings" ? (
          <SettingsPage onBack={goHome} />
        ) : null}

        {route.name === "import" ? <ImportPage onBack={goHome} /> : null}

        {route.name === "profile" ? <ProfilePage onBack={goHome} /> : null}
      </main>
      <SiteFooter />
    </div>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <I18nBridge>
        <Shell />
      </I18nBridge>
    </AppStoreProvider>
  );
}
