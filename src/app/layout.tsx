import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import TopNav from "@/components/TopNav";
import PrintHeader from "@/components/PrintHeader";
import "./globals.css";
import { Providers } from "./providers";
import CampusBackground from "@/components/CampusBackground";
import PwaRegistrar from "@/components/PwaRegistrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EJUST Student Hub",
  description:
    "Campus master plan, free rooms finder, GPA predictor, and timetable builder for the Egypt-Japan University of Science and Technology",
  applicationName: "E-JUST Student Hub",
  appleWebApp: {
    capable: true,
    title: "E-JUST Hub",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-180.png",
  },
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <CampusBackground />
          <PwaRegistrar />
          <div className="relative z-10 flex min-h-full flex-1 flex-col">
            <PrintHeader />
            <TopNav />
            <div className="flex flex-1 flex-col print:flex-none">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
