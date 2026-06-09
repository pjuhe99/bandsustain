"use client";
import { useEffect } from "react";

/**
 * 모달·바텀시트가 열려 있는 동안 배경(문서) 스크롤을 완전히 잠근다.
 *
 * `body { overflow: hidden }` 만으로는 부족하다:
 *  - 터치 기기(특히 iOS Safari)에서 배경이 스크롤/러버밴딩됨
 *  - 모달 내부 스크롤 영역이 짧아 스크롤 여지가 없을 때, 제스처가
 *    조상으로 체이닝되어 배경이 움직임
 * 그래서 배경을 `position: fixed` 로 흐름에서 제거해(스크롤 위치는 보존)
 * 어떤 기기에서도 배경이 움직일 수 없게 만든다. 닫히면 원래 위치로 복원.
 *
 * 스크롤바 폭만큼 padding-right 을 보정해 데스크톱에서 가로 점프를 막는다.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
