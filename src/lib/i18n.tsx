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
    dashboard: {
      title: "Student Hub", subtitle: "Everything you need for a focused campus day.",
      morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening",
      welcome: "Your campus, at a glance.", date: "Here is your day in one calm view.",
      launch: "Quick launch", launchHint: "Go straight to the tools you use most.",
      classes: "Today's classes", nextExam: "Next exam", gpa: "GPA snapshot",
      scholarship: "Scholarship deadline", food: "Food today", access: "Campus quick access",
      open: "Open", empty: "Nothing saved yet", plan: "Plan now", saved: "Saved on this device",
      map: "Spatial map", mapDesc: "Find your way across campus.",
      gpaDesc: "Track your academic direction.", notes: "Notes & past papers", notesDesc: "Study resources, in one place.",
      exams: "Schedule & exams", examsDesc: "Stay ahead of your next deadline.",
      cafeteria: "Campus life", cafeteriaDesc: "Plan meals and explore campus.",
      admin: "Admin panel", adminDesc: "Review community contributions.",
    },
    services: {
      gpa: "GPA Tracker", notes: "Lecture Notes", pastPapers: "Past Papers",
      back: "Back to Dashboard",
    },
    contribute: { title: "Community contributions", submit: "Submit contribution" },
    admin: { title: "Registrar oversight", approve: "Approve", reject: "Reject" },
    map: {
      title: "Campus spatial map", subtitle: "Navigate E-JUST with a live spatial guide.",
      search: "Search buildings", all: "All zones", academic: "Academic", services: "Services",
      dining: "Dining", housing: "Housing", from: "From", to: "To", choose: "Choose a building",
      route: "Plan route", clear: "Clear route", floors: "Floor directory", actions: "Quick actions",
      start: "Start here", arrive: "Set as destination", open: "Open details",
      admin: "Main Admin", library: "Central Library", faculty: "Faculty Buildings",
      studentHousing: "Student Housing", sports: "Sports Complex", gate: "Gate G.1",
      adminDescription: "Registration, student services, and campus operations.",
      libraryDescription: "Quiet study floors, research desks, and digital collections.",
      facultyDescription: "Engineering, science, and humanities teaching spaces.",
      studentHousingDescription: "Residential blocks with shared lounges and study rooms.",
      sportsDescription: "Indoor courts, open fields, and student wellness facilities.",
      gateDescription: "The primary arrival point for the E-JUST campus.",
    },
    cafeteria: {
      title: "Cafeteria & meal budget", subtitle: "Build a better tray, keep your week on track.",
      menu: "Live menu", crowd: "Crowd density", feedback: "Share feedback", opening: "Opening hours",
      low: "Low", medium: "Medium", high: "High", open: "Open now", closed: "Closed",
      submit: "Send feedback", feedbackPlaceholder: "How was your cafeteria experience?",
      clear: "Clear tray", tray: "Your tray", options: "options",
    },
    scholarships: {
      title: "Find your next opportunity", subtitle: "A focused shortlist of funding for E-JUST students.",
      search: "Search scholarships", eligibility: "Eligibility checklist", deadline: "Deadline",
      undergraduate: "Undergraduate", research: "Research", exchange: "Exchange",
      saved: "saved", apply: "View application", all: "All levels", full: "Full funding",
    },
    auth: {
      welcome: "Welcome back", subtitle: "Sign in to sync your campus life.",
      email: "University email", password: "Password", signIn: "Sign in", signingIn: "Signing in…",
      google: "Continue with Google", newHere: "New here?", create: "Create an account",
      invalidEmail: "Use a valid university email address.", invalidPassword: "Enter your password.",
      invalidCredentials: "Invalid email or password.", network: "Network error. Please try again.",
      onboarding: "Set up your student profile", faculty: "Faculty", year: "Year", major: "Major",
      next: "Continue", back: "Back", finish: "Finish setup", choose: "Choose an option",
    },
    study: {
      notes: "Lecture notes", pastPapers: "Past papers", search: "Search resources",
      filters: "Filters", upload: "Upload resource", download: "Download", pages: "pages",
      fileSize: "File size", noResults: "No resources match those filters.", solutions: "Solutions",
      all: "All", gpa: "GPA predictor", exams: "Exam planner", target: "Target GPA",
      current: "Current GPA", forecast: "Forecast GPA", progress: "Degree progress",
      addCourse: "Add course", courses: "Courses", projection: "Grade projection",
      countdown: "Next exam", hall: "Exam hall", seat: "Seat assignment", lookup: "Look up seat",
      hours: "Daily study hours", export: "Export calendar",
    },
    timetable: {
      title: "My timetable", subtitle: "Build a schedule that fits your degree and study load.",
      faculty: "Faculty", academicYear: "Academic year", group: "Group", fall: "Fall 2026",
      csit: "CSIT", engineering: "Engineering", business: "Business",
      firstYear: "1st Year", secondYear: "2nd Year", thirdYear: "3rd Year", fourthYear: "4th Year",
      group1: "Group 1", group2: "Group 2", addCourse: "Add custom course",
      reset: "Reset to default", export: "Export .ics", print: "Print",
      lecture: "Lecture", lab: "Lab", tutorial: "Tutorial", custom: "Custom",
      courseName: "Course name", code: "Course code", day: "Day", start: "Start time",
      end: "End time", location: "Room / lab location", instructor: "Instructor",
      cancel: "Cancel", add: "Add course", required: "Course name and code are required.",
      invalidTime: "End time must be after start time.", remove: "Remove", empty: "No classes scheduled for this day.",
      conflicts: "conflicts detected", confirmRemove: "Remove this course from your timetable?",
      resetConfirm: "Reset this profile to its default schedule? Custom courses will be removed.",
      saved: "Saved on this device", customCourses: "custom courses",
    },
  },
  ar: {
    nav: {
      today: "اليوم", plan: "مخطط الحرم", map: "خريطة GPS", gpa: "متابعة المعدل",
      timetable: "الجدول", exams: "الامتحانات", cafeteria: "الكافتيريا",
      scholarships: "المنح", assistant: "المساعد", contribute: "مساهمة",
      signIn: "تسجيل الدخول", signOut: "تسجيل الخروج", language: "اللغة", theme: "المظهر",
    },
    dashboard: {
      title: "بوابة الطالب", subtitle: "كل ما تحتاجه ليوم جامعي أكثر تركيزاً.",
      morning: "صباح الخير", afternoon: "مساء الخير", evening: "مساء الخير",
      welcome: "حرمك الجامعي في نظرة واحدة.", date: "إليك يومك في عرض هادئ ومركّز.",
      launch: "الوصول السريع", launchHint: "انتقل مباشرة إلى الأدوات التي تستخدمها.",
      classes: "محاضرات اليوم", nextExam: "الامتحان القادم", gpa: "ملخص المعدل",
      scholarship: "موعد المنحة", food: "طعام اليوم", access: "وصول سريع للحرم",
      open: "فتح", empty: "لا توجد بيانات محفوظة", plan: "خطط الآن", saved: "محفوظ على هذا الجهاز",
      map: "الخريطة المكانية", mapDesc: "اعثر على طريقك داخل الحرم.",
      gpaDesc: "تابع مسارك الأكاديمي.", notes: "الملاحظات ونماذج الامتحانات", notesDesc: "مواردك الدراسية في مكان واحد.",
      exams: "الجدول والامتحانات", examsDesc: "ابقَ مستعداً لموعدك القادم.",
      cafeteria: "حياة الحرم", cafeteriaDesc: "خطط وجباتك واستكشف الحرم.",
      admin: "لوحة الإدارة", adminDesc: "راجع مساهمات المجتمع.",
    },
    services: { gpa: "متابعة المعدل", notes: "ملاحظات المحاضرات", pastPapers: "نماذج الامتحانات", back: "العودة للبوابة" },
    contribute: { title: "مساهمات المجتمع", submit: "إرسال مساهمة" },
    admin: { title: "إشراف شؤون الطلاب", approve: "اعتماد", reject: "رفض" },
    map: {
      title: "الخريطة المكانية للحرم", subtitle: "تنقل في جامعة E-JUST عبر دليل مكاني مباشر.",
      search: "ابحث عن مبنى", all: "كل المناطق", academic: "أكاديمي", services: "خدمات",
      dining: "طعام", housing: "سكن", from: "من", to: "إلى", choose: "اختر مبنى",
      route: "خطط المسار", clear: "مسح المسار", floors: "دليل الطوابق", actions: "إجراءات سريعة",
      start: "ابدأ من هنا", arrive: "حدد كوجهة", open: "فتح التفاصيل",
      admin: "الإدارة الرئيسية", library: "المكتبة المركزية", faculty: "مباني الكليات",
      studentHousing: "سكن الطلاب", sports: "المجمع الرياضي", gate: "البوابة G.1",
      adminDescription: "التسجيل وخدمات الطلاب وعمليات الحرم.",
      libraryDescription: "طوابق هادئة ومكاتب بحث ومجموعات رقمية.",
      facultyDescription: "مساحات تدريس الهندسة والعلوم والعلوم الإنسانية.",
      studentHousingDescription: "مبانٍ سكنية مع صالات ومناطق دراسة مشتركة.",
      sportsDescription: "ملاعب داخلية وحقول ومرافق لصحة الطلاب.",
      gateDescription: "نقطة الوصول الرئيسية إلى حرم الجامعة.",
    },
    cafeteria: {
      title: "الكافتيريا وميزانية الوجبات", subtitle: "كوّن وجبتك وحافظ على ميزانيتك.",
      menu: "القائمة المباشرة", crowd: "كثافة الحضور", feedback: "شارك رأيك", opening: "ساعات العمل",
      low: "منخفض", medium: "متوسط", high: "مرتفع", open: "مفتوح الآن", closed: "مغلق",
      submit: "إرسال الرأي", feedbackPlaceholder: "كيف كانت تجربتك في الكافتيريا؟",
      clear: "مسح الصينية", tray: "صينيتك", options: "خيارات",
    },
    scholarships: {
      title: "اكتشف فرصتك القادمة", subtitle: "قائمة مركزة من المنح لطلاب E-JUST.",
      search: "ابحث عن منحة", eligibility: "قائمة الأهلية", deadline: "الموعد النهائي",
      undergraduate: "مرحلة البكالوريوس", research: "بحث", exchange: "تبادل",
      saved: "محفوظة", apply: "عرض التقديم", all: "كل المراحل", full: "تمويل كامل",
    },
    auth: {
      welcome: "مرحباً بعودتك", subtitle: "سجل الدخول لمزامنة حياتك الجامعية.",
      email: "البريد الجامعي", password: "كلمة المرور", signIn: "تسجيل الدخول", signingIn: "جارٍ الدخول…",
      google: "المتابعة باستخدام Google", newHere: "جديد هنا؟", create: "إنشاء حساب",
      invalidEmail: "استخدم بريداً جامعياً صحيحاً.", invalidPassword: "أدخل كلمة المرور.",
      invalidCredentials: "البريد أو كلمة المرور غير صحيحة.", network: "خطأ في الشبكة. حاول مرة أخرى.",
      onboarding: "أعد ملفك الطلابي", faculty: "الكلية", year: "السنة", major: "التخصص",
      next: "متابعة", back: "رجوع", finish: "إنهاء الإعداد", choose: "اختر",
    },
    study: {
      notes: "ملاحظات المحاضرات", pastPapers: "نماذج الامتحانات", search: "ابحث في الموارد",
      filters: "التصفية", upload: "رفع مورد", download: "تحميل", pages: "صفحات",
      fileSize: "حجم الملف", noResults: "لا توجد موارد مطابقة.", solutions: "الحلول",
      all: "الكل", gpa: "متابعة المعدل", exams: "مخطط الامتحانات", target: "المعدل المستهدف",
      current: "المعدل الحالي", forecast: "المعدل المتوقع", progress: "التقدم الدراسي",
      addCourse: "إضافة مقرر", courses: "المقررات", projection: "توقع الدرجات",
      countdown: "الامتحان القادم", hall: "قاعة الامتحان", seat: "رقم المقعد", lookup: "البحث عن المقعد",
      hours: "ساعات الدراسة اليومية", export: "تصدير التقويم",
    },
    timetable: {
      title: "جدولي الدراسي", subtitle: "أنشئ جدولاً يناسب تخصصك وحملك الدراسي.",
      faculty: "الكلية", academicYear: "السنة الدراسية", group: "المجموعة", fall: "خريف 2026",
      csit: "حاسبات ومعلومات", engineering: "الهندسة", business: "إدارة الأعمال",
      firstYear: "الفرقة الأولى", secondYear: "الفرقة الثانية", thirdYear: "الفرقة الثالثة", fourthYear: "الفرقة الرابعة",
      group1: "المجموعة 1", group2: "المجموعة 2", addCourse: "إضافة مقرر مخصص",
      reset: "إعادة الافتراضي", export: "تصدير .ics", print: "طباعة",
      lecture: "محاضرة", lab: "معمل", tutorial: "تمرين", custom: "مخصص",
      courseName: "اسم المقرر", code: "كود المقرر", day: "اليوم", start: "وقت البدء",
      end: "وقت الانتهاء", location: "القاعة / المعمل", instructor: "المحاضر",
      cancel: "إلغاء", add: "إضافة المقرر", required: "اسم المقرر والكود مطلوبان.",
      invalidTime: "يجب أن يكون وقت الانتهاء بعد البدء.", remove: "حذف", empty: "لا توجد محاضرات لهذا اليوم.",
      conflicts: "تعارضات", confirmRemove: "حذف هذا المقرر من جدولك؟",
      resetConfirm: "إعادة هذا الملف إلى جدوله الافتراضي؟ ستُحذف المقررات المخصصة.",
      saved: "محفوظ على هذا الجهاز", customCourses: "مقررات مخصصة",
    },
  },
  ja: {
    nav: {
      today: "今日", plan: "キャンパス案内", map: "GPSマップ", gpa: "GPAトラッカー",
      timetable: "時間割", exams: "試験", cafeteria: "カフェテリア",
      scholarships: "奨学金", assistant: "アシスタント", contribute: "投稿する",
      signIn: "ログイン", signOut: "ログアウト", language: "言語", theme: "テーマ",
    },
    dashboard: {
      title: "学生ハブ", subtitle: "集中したキャンパスライフに必要な情報をまとめました。",
      morning: "おはようございます", afternoon: "こんにちは", evening: "こんばんは",
      welcome: "キャンパスをひと目で確認。", date: "今日の予定を落ち着いて確認しましょう。",
      launch: "クイック起動", launchHint: "よく使うツールへすぐ移動できます。",
      classes: "今日の授業", nextExam: "次の試験", gpa: "GPAスナップショット",
      scholarship: "奨学金の締切", food: "今日の食事", access: "キャンパスへの近道",
      open: "開く", empty: "保存された情報はありません", plan: "今すぐ計画", saved: "この端末に保存済み",
      map: "空間マップ", mapDesc: "キャンパス内の道を探します。",
      gpaDesc: "学業の方向を確認します。", notes: "ノートと過去問", notesDesc: "学習資料を一か所に。",
      exams: "時間割と試験", examsDesc: "次の締切に備えます。",
      cafeteria: "キャンパスライフ", cafeteriaDesc: "食事を計画し、キャンパスを探索。",
      admin: "管理パネル", adminDesc: "コミュニティ投稿を確認します。",
    },
    services: { gpa: "GPAトラッカー", notes: "講義ノート", pastPapers: "過去問", back: "ダッシュボードへ戻る" },
    contribute: { title: "コミュニティ投稿", submit: "投稿を送信" },
    admin: { title: "教務管理", approve: "承認", reject: "却下" },
    map: {
      title: "キャンパス空間マップ", subtitle: "E-JUSTをライブ空間ガイドで移動します。",
      search: "建物を検索", all: "すべて", academic: "学術", services: "サービス",
      dining: "食堂", housing: "住居", from: "出発", to: "到着", choose: "建物を選択",
      route: "ルートを作成", clear: "ルートを消去", floors: "フロア案内", actions: "クイック操作",
      start: "ここから開始", arrive: "目的地に設定", open: "詳細を開く",
      admin: "本部管理棟", library: "中央図書館", faculty: "学部棟",
      studentHousing: "学生寮", sports: "スポーツ複合施設", gate: "G.1ゲート",
      adminDescription: "登録、学生サービス、キャンパス運営。",
      libraryDescription: "静かな学習フロア、研究デスク、デジタル資料。",
      facultyDescription: "工学、理学、人文学の教育スペース。",
      studentHousingDescription: "共有ラウンジと学習室のある居住棟。",
      sportsDescription: "屋内コート、グラウンド、学生向けウェルネス施設。",
      gateDescription: "E-JUSTキャンパスの主要な入口。",
    },
    cafeteria: {
      title: "カフェテリアと食費", subtitle: "食事を選び、週間予算を管理します。",
      menu: "ライブメニュー", crowd: "混雑状況", feedback: "フィードバック", opening: "営業時間",
      low: "低い", medium: "普通", high: "高い", open: "営業中", closed: "閉店",
      submit: "送信", feedbackPlaceholder: "カフェテリアの感想を教えてください。",
      clear: "トレイを消去", tray: "あなたのトレイ", options: "選択肢",
    },
    scholarships: {
      title: "次の機会を見つける", subtitle: "E-JUST学生向けの支援を厳選しました。",
      search: "奨学金を検索", eligibility: "応募資格", deadline: "締切",
      undergraduate: "学部", research: "研究", exchange: "交換留学",
      saved: "保存済み", apply: "応募ページ", all: "すべて", full: "全額支援",
    },
    auth: {
      welcome: "おかえりなさい", subtitle: "ログインしてキャンパス生活を同期します。",
      email: "大学メール", password: "パスワード", signIn: "ログイン", signingIn: "ログイン中…",
      google: "Googleで続行", newHere: "初めてですか？", create: "アカウントを作成",
      invalidEmail: "有効な大学メールを入力してください。", invalidPassword: "パスワードを入力してください。",
      invalidCredentials: "メールまたはパスワードが違います。", network: "ネットワークエラーです。",
      onboarding: "学生プロフィールを設定", faculty: "学部", year: "学年", major: "専攻",
      next: "次へ", back: "戻る", finish: "設定を完了", choose: "選択",
    },
    study: {
      notes: "講義ノート", pastPapers: "過去問", search: "リソースを検索",
      filters: "フィルター", upload: "リソースをアップロード", download: "ダウンロード", pages: "ページ",
      fileSize: "ファイルサイズ", noResults: "一致する資料はありません。", solutions: "解答",
      all: "すべて", gpa: "GPA予測", exams: "試験プランナー", target: "目標GPA",
      current: "現在のGPA", forecast: "予測GPA", progress: "学位進捗",
      addCourse: "科目を追加", courses: "科目", projection: "成績予測",
      countdown: "次の試験", hall: "試験会場", seat: "座席番号", lookup: "座席を検索",
      hours: "1日の学習時間", export: "カレンダーへ出力",
    },
    timetable: {
      title: "マイ時間割", subtitle: "学部と学習負荷に合わせて時間割を作成します。",
      faculty: "学部", academicYear: "学年", group: "グループ", fall: "2026年秋学期",
      csit: "情報技術", engineering: "工学", business: "経営",
      firstYear: "1年", secondYear: "2年", thirdYear: "3年", fourthYear: "4年",
      group1: "グループ1", group2: "グループ2", addCourse: "科目を追加",
      reset: "初期時間割に戻す", export: ".icsを書き出す", print: "印刷",
      lecture: "講義", lab: "実験", tutorial: "演習", custom: "カスタム",
      courseName: "科目名", code: "科目コード", day: "曜日", start: "開始時刻",
      end: "終了時刻", location: "教室 / 実験室", instructor: "担当教員",
      cancel: "キャンセル", add: "科目を追加", required: "科目名とコードは必須です。",
      invalidTime: "終了時刻は開始時刻より後にしてください。", remove: "削除", empty: "この曜日に授業はありません。",
      conflicts: "件の重複", confirmRemove: "この科目を時間割から削除しますか？",
      resetConfirm: "このプロフィールを初期時間割に戻しますか？カスタム科目は削除されます。",
      saved: "この端末に保存済み", customCourses: "カスタム科目",
    },
  },
} as const;

type Dictionary = (typeof dictionaries)["en"];
type TranslationKey =
  | `nav.${keyof Dictionary["nav"]}`
  | `dashboard.${keyof Dictionary["dashboard"]}`
  | `services.${keyof Dictionary["services"]}`
  | `contribute.${keyof Dictionary["contribute"]}`
  | `admin.${keyof Dictionary["admin"]}`
  | `map.${keyof Dictionary["map"]}`
  | `cafeteria.${keyof Dictionary["cafeteria"]}`
  | `scholarships.${keyof Dictionary["scholarships"]}`
  | `auth.${keyof Dictionary["auth"]}`
  | `study.${keyof Dictionary["study"]}`
  | `timetable.${keyof Dictionary["timetable"]}`;

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
