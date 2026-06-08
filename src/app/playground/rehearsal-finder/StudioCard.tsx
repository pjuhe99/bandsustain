"use client";
import { buttonClasses } from "@/components/Button";
import { ROOM_EQUIPMENT_LABELS, type RoomEquipmentType } from "@/lib/playground/rehearsal/types";

export type CardGear = { name: string; type: string };
export type CardRoom = { id: number; name: string; hourlyPrice: number | null; capacity: number | null; equipment: CardGear[]; review: string | null };
export type CardStudio = {
  name: string; regionName: string | null; areaLabel: string | null; roadAddress: string | null; phone: string | null;
  bookingMethod: string | null; amenities: string | null; homepageUrl: string | null; mapUrl: string | null;
  imageUrl: string | null;
  hourlyPriceMin: number | null; hourlyPriceMax: number | null; hasParking: boolean;
  equipmentTypes: RoomEquipmentType[]; rooms: CardRoom[];
};
export type CardTravel = {
  avgMinutes: number; maxMinutes: number;
  memberRoutes: { nickname: string; route: { travelMinutes: number } }[];
};

function priceLabel(min: number | null, max: number | null): string | null {
  if (!min) return null;
  return max && max !== min
    ? `${min.toLocaleString("ko-KR")}~${max.toLocaleString("ko-KR")}원`
    : `${min.toLocaleString("ko-KR")}원`;
}

export default function StudioCard({
  studio, rankNo, reason, travel, onDetail,
}: {
  studio: CardStudio;
  rankNo?: number;
  reason?: string;
  travel?: CardTravel;
  onDetail: (s: CardStudio) => void;
}) {
  const price = priceLabel(studio.hourlyPriceMin, studio.hourlyPriceMax);
  const noRooms = studio.rooms.length === 0;
  return (
    <div className="border border-[var(--color-border)] p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display font-bold text-lg">{rankNo ? `${rankNo}. ` : ""}{studio.name}</h3>
        <span className="shrink-0 text-sm text-[var(--color-text-muted)]">{studio.regionName ?? studio.areaLabel ?? ""}</span>
      </div>
      {reason && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{reason}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {travel && <span>⏱ 평균 {Math.round(travel.avgMinutes)}분 · 최대 {Math.round(travel.maxMinutes)}분</span>}
        {price ? <span>💸 {price}</span> : <span className="text-[var(--color-text-muted)]">💸 가격 정보 없음</span>}
        {noRooms
          ? <span className="text-[var(--color-text-muted)]">🚪 방 정보 없음</span>
          : <span>🚪 방 {studio.rooms.length}</span>}
        {studio.hasParking && <span>🅿 주차</span>}
      </div>
      {studio.equipmentTypes.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {studio.equipmentTypes.map((t) => (
            <span key={t} className="rounded border border-[var(--color-border-strong)] px-1.5 py-0.5 text-[11px]">{ROOM_EQUIPMENT_LABELS[t]}</span>
          ))}
        </div>
      ) : noRooms ? (
        <div className="mt-2 text-xs text-[var(--color-text-muted)]">악기 정보 없음</div>
      ) : null}
      {travel && (
        <ul className="mt-2 flex flex-wrap gap-x-4 text-xs text-[var(--color-text-muted)]">
          {travel.memberRoutes.map((mr, i) => <li key={i}>{mr.nickname}: {mr.route.travelMinutes}분</li>)}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-3 text-sm">
        <button type="button" onClick={() => onDetail(studio)} className={buttonClasses("secondary", "px-4 py-2 text-xs")}>자세히 보기</button>
        {studio.mapUrl && <a href={studio.mapUrl} target="_blank" rel="noreferrer" className="underline">지도</a>}
      </div>
    </div>
  );
}
