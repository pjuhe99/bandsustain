"use client";

import Script from "next/script";

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      init: (key: string) => void;
      Share?: {
        sendDefault: (args: object) => void;
      };
    };
  }
}

export default function KakaoSdk() {
  const key = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
  if (!key) return null;
  return (
    <Script
      src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(key);
        }
      }}
    />
  );
}
