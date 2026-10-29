"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "en" | "ar" | "ja";

const dictionaries = {
  en: {
    nav: {
      today: "Today", plan: "Master Plan", map: "GPS Map", gpa: "GPA Tracker",
      timetable: "Timetable", exams: "Exams", cafeteria: "Cafeteria",
      scholarships: "Scholarships", assistant: "Assistant", contribute: "Contribute",
      signIn: "Sign in", signOut: "Sign out", language: "Language", theme: "Theme",
    },
    dashboard: { title: "Student Hub", subtitle: "Everything you need for a focused campus day." },
    services: {
      gpa: "GPA Tracker", notes: "Lecture Notes", pastPapers: "Past Papers",
      back: "Back to Dashboard",
    },
    contribute: { title: "Community contributions", submit: "Submit contribution" },
    admin: { title: "Registrar oversight", approve: "Approve", reject: "Reject" },
  },
  ar: {
    nav: {
      today: "اليوم", plan: "مخطط الحرم", map: "خريطة GPS", gpa: "متابعة المعدل",
      timetable: "الجدول", exams: "الامتحانات", cafeteria: "الكافتيريا",
      scholarships: "المنح", assistant: "المساعد", contribute: "مساهمة",
      signIn: "تسجيل الدخول", signOut: "تسجيل الخروج", language: "اللغة", theme: "المظهر",
    },
    dashboard: { title: "بوابة الطالب", subtitle: "كل ما تحتاجه ليوم جامعي أكثر تركيزاً." },
    services: { gpa: "متابعة المعدل", notes: "ملاحظات المحاضرات", pastPapers: "نماذج الامتحانات", back: "العودة للبوابة" },
    contribute: { title: "مساهمات المجتمع", submit: "إرسال مساهمة" },
    admin: { title: "إشراف شؤون الطلاب", approve: "اعتماد", reject: "رفض" },
  },
  ja: {
    nav: {
      today: "今日", plan: "キャンパス案内", map: "GPSマップ", gpa: "GPAトラッカー",
      timetable: "時間割", exams: "試験", cafeteria: "カフェテリア",
      scholarships: "奨学金", assistant: "アシスタント", contribute: "投稿する",
      signIn: "ログイン", signOut: "ログアウト", language: "言語", theme: "テーマ",
    },
    dashboard: { title: "学生ハブ", subtitle: "集中したキャンパスライフに必要な情報をまとめました。" },
    services: { gpa: "GPAトラッカー", notes: "講義ノート", pastPapers: "過去問", back: "ダッシュボードへ戻る" },
    contribute: { title: "コミュニティ投稿", submit: "投稿を送信" },
    admin: { title: "教務管理", approve: "承認", reject: "却下" },
  },
} as const;

type Dictionary = (typeof dictionaries)["en"];
type TranslationKey =
  | `nav.${keyof Dictionary["nav"]}`
  | `dashboard.${keyof Dictionary["dashboard"]}`
  | `services.${keyof Dictionary["services"]}`
  | `contribute.${keyof Dictionary["contribute"]}`
  | `admin.${keyof Dictionary["admin"]}`;

const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
} | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    window.localStorage.setItem("ejust-locale", locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    t: (key: TranslationKey) => {
      const [group, item] = key.split(".") as [keyof Dictionary, string];
      return String((dictionaries[locale][group] as Record<string, string>)[item] ?? key);
    },
  }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
