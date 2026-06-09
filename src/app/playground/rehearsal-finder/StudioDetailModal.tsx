"use client";
import { useEffect } from "react";
import { useScrollLock } from "@/lib/useScrollLock";
import { ROOM_EQUIPMENT_TYPES, ROOM_EQUIPMENT_LABELS, type RoomEquipmentType } from "@/lib/playground/rehearsal/types";

type Gear = { name: string; type: string };
type DetailRoom = { id: number; name: string; hourlyPrice: number | null; capacity: number | null; equipment: Gear[]; review: string | null };
export type DetailStudio = {
  name: string; regionName: string | null; areaLabel: string | null; roadAddress: string | null; phone: string | null;
  bookingMethod: string | null; amenities: string | null; homepageUrl: string | null; mapUrl: string | null;
  imageUrl: string | null;
  rooms: DetailRoom[];
};

export default function StudioDetailModal({ studio, onClose }: { studio: DetailStudio | null; onClose: () => void }) {
  useScrollLock(Boolean(studio));
  useEffect(() => {
    if (!studio) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [studio, onClose]);

  if (!studio) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex w-full max-h-[88vh] flex-col rounded-t-2xl bg-[var(--color-bg)] shadow-xl sm:max-w-lg sm:max-h-[80vh] sm:rounded-lg">
        <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="font-display font-bold text-lg">{studio.name}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">{studio.regionName ?? studio.areaLabel ?? ""}</p>
          </div>
          <button type="button" aria-label="닫기" onClick={onClose} className="px-2 text-lg leading-none text-[var(--color-text-muted)]">✕</button>
        </div>
        <div className="space-y-5 overflow-auto overscroll-contain px-5 py-4">
          {studio.imageUrl && (
            // 네이버 원본 CDN 직접 표시(핫링크). 서버 미호스팅 — no-referrer 로 우리 도메인 노출/핫링크 차단 회피.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={studio.imageUrl}
              alt={`${studio.name} 사진`}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="max-h-60 w-full rounded-md object-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          )}
          <div className="space-y-1 text-sm">
            {studio.roadAddress && <p>📍 {studio.roadAddress}</p>}
            {studio.phone && <p className="text-[var(--color-text-muted)]">📞 {studio.phone}</p>}
            {studio.bookingMethod && <p className="text-[var(--color-text-muted)]">예약 방식: {studio.bookingMethod}</p>}
            {studio.amenities && <p className="text-[var(--color-text-muted)]">{studio.amenities}</p>}
            <div className="flex flex-wrap gap-3 pt-1">
              {studio.mapUrl && <a href={studio.mapUrl} target="_blank" rel="noreferrer" className="underline">네이버 지도</a>}
              {studio.homepageUrl && <a href={studio.homepageUrl} target="_blank" rel="noreferrer" className="underline">홈페이지·예약</a>}
            </div>
          </div>
          <div className="space-y-3">
            {studio.rooms.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">방·가격·악기 정보가 아직 없어요. 네이버 지도에서 확인해주세요.</p>
            ) : (
              <>
                <h4 className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">방 {studio.rooms.length}개</h4>
                {studio.rooms.map((room) => (
                  <div key={room.id} className="border border-[var(--color-border)] p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-bold text-sm">{room.name}</span>
                      <span className="shrink-0 text-sm text-[var(--color-text-muted)]">
                        {room.hourlyPrice ? `${room.hourlyPrice.toLocaleString("ko-KR")}원/시간` : ""}
                        {room.capacity ? ` · ${room.capacity}인` : ""}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {(ROOM_EQUIPMENT_TYPES as readonly RoomEquipmentType[])
                        .filter((t) => room.equipment.some((g) => g.type === t))
                        .map((t) => (
                          <div key={t} className="flex gap-2 text-xs">
                            <span className="w-16 shrink-0 text-[var(--color-text-muted)]">{ROOM_EQUIPMENT_LABELS[t]}</span>
                            <span>{room.equipment.filter((g) => g.type === t).map((g) => g.name).join(", ")}</span>
                          </div>
                        ))}
                    </div>
                    {room.review && <p className="mt-2 whitespace-pre-line text-xs text-[var(--color-text-muted)]">{room.review}</p>}
                  </div>
                ))}
              </>
            )}
          </div>
          <p className="border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-muted)]">
            ℹ️ 합주실 상세 정보(방·가격·악기·사진 등)는 계속 업데이트하고 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}
