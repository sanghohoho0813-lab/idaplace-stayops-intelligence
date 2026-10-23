import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { buildThemeCss } from "@/lib/theme/themes";
import { AppProviders } from "@/components/providers/AppProviders";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "StayOps Intelligence · 이다플레이스 (DEMO)", template: "%s · StayOps Intelligence (DEMO)" },
  description: "개업 준비부터 무인 운영까지 연결하는 숙박 운영 AX — 시연용 MVP (실제 예약·도어락·매출 미연동)",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#121A2A",
};

// Hydration 전에 저장된 Theme/글자크기/모션 설정을 적용해 깜빡임을 막는다 (값 읽기만 수행)
const earlyPrefs = `(function(){try{var d=document.documentElement;if(window.self!==window.top){d.setAttribute('data-frame','mobile');}var s=JSON.parse(localStorage.getItem('stayops-demo:v1')||'null');if(!s||!s.ui)return;var u=s.ui;if(/^t0[1-7]$/.test(u.theme))d.setAttribute('data-theme',u.theme);d.setAttribute('data-brand',u.brandTune===false?'off':'on');if(/^(SM|MD|LG)$/.test(u.fontScale))d.setAttribute('data-font',u.fontScale);if(u.reduceMotion)d.setAttribute('data-motion','reduce');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="t01" data-brand="on" data-font="MD" suppressHydrationWarning>
      <head>
        <style id="stayops-theme" dangerouslySetInnerHTML={{ __html: buildThemeCss() }} />
        <script dangerouslySetInnerHTML={{ __html: earlyPrefs }} />
      </head>
      <body className={`${pretendard.variable} font-sans`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
