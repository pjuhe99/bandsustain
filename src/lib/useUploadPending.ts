"use client";
import { useCallback, useState } from "react";

/**
 * 폼 안의 `ImageUpload` 들이 업로드 중인지를 폼 단위로 집계한다.
 *
 * `ImageUpload` 는 자기 파일 입력만 `disabled` 시키므로, 업로드가 끝나기 전에
 * 상위 폼의 저장 버튼을 누를 수 있었다. 그러면 hidden input 이 아직 빈 문자열인
 * 채로 제출돼 서버 액션의 zod 검증에서 "검증 실패" 로만 튕긴다(파일은 이미
 * 업로드된 상태라 원인도 알기 어렵다).
 *
 * 반환한 `onPendingChange` 를 각 `ImageUpload` 에 넘기면, 진행 중인 업로드를
 * 필드 이름(`name`)으로 집합에 모은다. 한 폼에 업로드가 여러 개여도(뉴스의
 * Hero + Mid) 하나라도 진행 중이면 `uploading` 이 참이고, 전부 끝나야 풀린다.
 * 성공·실패·취소 어느 쪽으로 끝나든 `ImageUpload` 가 항상 해제를 보고하므로
 * 버튼이 영구히 잠기지 않는다.
 */
export function useUploadPending() {
  const [names, setNames] = useState<ReadonlySet<string>>(() => new Set());

  const onPendingChange = useCallback((name: string, pending: boolean) => {
    setNames((prev) => {
      if (prev.has(name) === pending) return prev; // 상태 동일 → 리렌더 없음
      const next = new Set(prev);
      if (pending) next.add(name);
      else next.delete(name);
      return next;
    });
  }, []);

  return { uploading: names.size > 0, onPendingChange };
}
