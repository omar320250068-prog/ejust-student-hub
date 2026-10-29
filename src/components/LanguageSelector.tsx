"use client";

import { Globe2 } from "lucide-react";
import { useLanguage, type Locale } from "@/lib/i18n";

export default function LanguageSelector() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <label className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-2 text-xs text-gray-600 dark:border-slate-700 dark:text-slate-300">
      <Globe2 size={14} />
      <span className="sr-only">{t("nav.language")}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="bg-transparent font-medium outline-none"
        aria-label={t("nav.language")}
      >
        <option value="en">EN</option>
        <option value="ar">AR</option>
        <option value="ja">日本語</option>
      </select>
    </label>
  );
}
