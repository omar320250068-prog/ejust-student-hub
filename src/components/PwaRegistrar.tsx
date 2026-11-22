"use client";

import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const INSTALL_DISMISSED = "ejust:pwa-install-dismissed";
const IOS_DISMISSED = "ejust:pwa-ios-dismissed";

function isDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function dismiss(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Storage may be disabled; dismiss for this session only.
  }
}

/** Registers the service worker and shows a localized, dismissible install hint. */
export default function PwaRegistrar() {
  const { t } = useLanguage();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (!isDismissed(INSTALL_DISMISSED)) setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // Defer the iOS tip so the effect only subscribes/updates external state.
    const timer = window.setTimeout(() => {
      const standalone =
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches;
      const isIos = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
      if (isIos && !standalone && !isDismissed(IOS_DISMISSED)) setShowIos(true);
    }, 0);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(timer);
    };
  }, []);

  if (!promptEvent && !showIos) return null;

  return (
    <div className="print:hidden fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md flex-col gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4">
      {showIos && (
        <div className="flex items-start gap-3 rounded-xl border border-cyan-200 bg-white p-3 text-sm shadow-lg dark:border-cyan-800 dark:bg-slate-900">
          <Share2 size={17} className="mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-300" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 dark:text-white">{t("pwa.iosTitle")}</p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{t("pwa.iosBody")}</p>
          </div>
          <button
            type="button"
            aria-label={t("pwa.close")}
            onClick={() => {
              dismiss(IOS_DISMISSED);
              setShowIos(false);
            }}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {promptEvent && (
        <div className="flex items-start gap-3 rounded-xl border border-cyan-300 bg-white p-3 text-sm shadow-lg dark:border-cyan-700 dark:bg-slate-900">
          <Download size={17} className="mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-300" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 dark:text-white">{t("pwa.installTitle")}</p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{t("pwa.installBody")}</p>
            <button
              type="button"
              onClick={() => {
                void promptEvent.prompt();
                setPromptEvent(null);
              }}
              className="mt-2 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-cyan-700"
            >
              {t("pwa.install")}
            </button>
          </div>
          <button
            type="button"
            aria-label={t("pwa.dismiss")}
            onClick={() => {
              dismiss(INSTALL_DISMISSED);
              setPromptEvent(null);
            }}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
