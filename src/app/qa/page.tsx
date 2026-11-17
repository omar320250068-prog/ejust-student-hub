"use client";

import QaBoard from "@/components/QaBoard";
import { MotionSection, ServicePageShell } from "@/components/ServicePageShell";
import { useLanguage } from "@/lib/i18n";

export default function QaPage() {
  const { t } = useLanguage();

  return (
    <ServicePageShell eyebrow={t("qa.eyebrow")} title={t("qa.title")} description={t("qa.subtitle")}>
      <MotionSection className="mt-8" delay={0.14}>
        <QaBoard />
      </MotionSection>
    </ServicePageShell>
  );
}
