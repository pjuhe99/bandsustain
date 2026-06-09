"use client";
import { useActionState, useState } from "react";
import { buttonClasses } from "@/components/Button";
import { STUDIO_STATUSES, ROOM_EQUIPMENT_LABELS, type Studio } from "@/lib/playground/rehearsal/types";
import { classifyGearList } from "@/lib/playground/rehearsal/gearClassify";
import { gearToText } from "@/lib/playground/rehearsal/adminRooms";
import type { FormState } from "@/app/admin/(authed)/rehearsal-studios/actions";

type Region = { id: number; displayName: string };
type RoomRow = { name: string; price: string; capacity: string; gear: string; review: string };

export default function RehearsalStudioForm({
  studio, regions, action, submitLabel,
}: {
  studio?: Studio;
  regions: Region[];
  action: (p: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [rooms, setRooms] = useState<RoomRow[]>(
    studio?.rooms.map((r) => ({
      name: r.name, price: r.hourlyPrice != null ? String(r.hourlyPrice) : "",
      capacity: r.capacity != null ? String(r.capacity) : "",
      gear: gearToText(r.equipment), review: r.review ?? "",
    })) ?? [],
  );
  const err = (k: string) => state.fieldErrors?.[k];
  const input = "border border-[var(--color-border-strong)] px-3 py-2 w-full text-sm";
  const label = "block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1";

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>이름</label>
          <input name="name" defaultValue={studio?.name} className={input} required />
          {err("name") && <p className="text-xs text-red-600">{err("name")}</p>}</div>
        <div><label className={label}>slug</label>
          <input name="slug" defaultValue={studio?.slug} className={input} required />
          {err("slug") && <p className="text-xs text-red-600">{err("slug")}</p>}</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>지역</label>
          <select name="regionId" defaultValue={studio?.regionId ?? ""} className={input}>
            <option value="">(없음)</option>
            {regions.map((rg) => <option key={rg.id} value={rg.id}>{rg.displayName}</option>)}
          </select></div>
        <div><label className={label}>지역 라벨(area_label)</label>
          <input name="areaLabel" defaultValue={studio?.areaLabel ?? ""} className={input} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>위도(lat)</label>
          <input name="lat" type="number" step="any" defaultValue={studio?.lat ?? ""} className={input} /></div>
        <div><label className={label}>경도(lng)</label>
          <input name="lng" type="number" step="any" defaultValue={studio?.lng ?? ""} className={input} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>최근접 역</label>
          <input name="nearestStation" defaultValue={studio?.nearestStation ?? ""} className={input} /></div>
        <div><label className={label}>역까지 거리(m)</label>
          <input name="nearestStationMeters" type="number" defaultValue={studio?.nearestStationMeters ?? ""} className={input} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>시간당 최저가 (방 있으면 자동)</label>
          <input name="hourlyPriceMin" type="number" defaultValue={studio?.hourlyPriceMin ?? ""} className={input} /></div>
        <div><label className={label}>시간당 최고가 (방 있으면 자동)</label>
          <input name="hourlyPriceMax" type="number" defaultValue={studio?.hourlyPriceMax ?? ""} className={input} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>최소 인원</label>
          <input name="minCapacity" type="number" defaultValue={studio?.minCapacity ?? ""} className={input} /></div>
        <div><label className={label}>최대 인원 (방 있으면 자동)</label>
          <input name="maxCapacity" type="number" defaultValue={studio?.maxCapacity ?? ""} className={input} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4 items-end">
        <div><label className={label}>상태</label>
          <select name="status" defaultValue={studio?.status ?? "candidate"} className={input}>
            {STUDIO_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="hasParking" defaultChecked={studio?.hasParking ?? false} /> 주차 가능
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>전화</label>
          <input name="phone" defaultValue={studio?.phone ?? ""} className={input} /></div>
        <div><label className={label}>도로명 주소</label>
          <input name="roadAddress" defaultValue={studio?.roadAddress ?? ""} className={input} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>예약 방식</label>
          <input name="bookingMethod" defaultValue={studio?.bookingMethod ?? ""} placeholder="네이버 예약, 전화 …" className={input} /></div>
        <div><label className={label}>부가정보(amenities)</label>
          <input name="amenities" defaultValue={studio?.amenities ?? ""} placeholder="악기대여 O, 주차 O …" className={input} /></div>
      </div>
      <div><label className={label}>홈페이지 URL</label>
        <input name="homepageUrl" defaultValue={studio?.homepageUrl ?? ""} className={input} /></div>
      <div><label className={label}>주차 메모</label>
        <input name="parkingNote" defaultValue={studio?.parkingNote ?? ""} className={input} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>예약 URL</label>
          <input name="bookingUrl" defaultValue={studio?.bookingUrl ?? ""} className={input} /></div>
        <div><label className={label}>지도 URL</label>
          <input name="mapUrl" defaultValue={studio?.mapUrl ?? ""} className={input} /></div>
      </div>
      <div><label className={label}>출처 메모</label>
        <input name="sourceNote" defaultValue={studio?.sourceNote ?? ""} className={input} /></div>

      {/* 방 동적 행 */}
      <fieldset className="border border-[var(--color-border)] p-4">
        <legend className="text-xs uppercase tracking-wider px-2">방 (가격·인원·악기)</legend>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">방이 1개 이상 있으면 합주실 가격(최저/최고)·최대 인원은 방에서 자동 계산됩니다. 장비는 쉼표로 구분해 입력하면 자동 분류돼요.</p>
        <div className="space-y-4">
          {rooms.map((row, i) => {
            const preview = classifyGearList(row.gear);
            return (
              <div key={i} className="border border-[var(--color-border)] p-3 space-y-2">
                <div className="grid grid-cols-[1fr_110px_80px_40px] gap-2 items-center">
                  <input name="roomName" value={row.name} placeholder="방 이름 (예: A룸)" className={input}
                    onChange={(e) => setRooms(rooms.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input name="roomPrice" value={row.price} placeholder="시간당 가격" inputMode="numeric" className={input}
                    onChange={(e) => setRooms(rooms.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
                  <input name="roomCapacity" value={row.capacity} placeholder="인원" inputMode="numeric" className={input}
                    onChange={(e) => setRooms(rooms.map((x, j) => j === i ? { ...x, capacity: e.target.value } : x))} />
                  <button type="button" aria-label="방 삭제" onClick={() => setRooms(rooms.filter((_, j) => j !== i))}
                    className="text-red-600 text-sm">✕</button>
                </div>
                <input name="roomGear" value={row.gear} placeholder="장비 (쉼표 구분: DW 드럼, 마샬 JCM900, …)" className={input}
                  onChange={(e) => setRooms(rooms.map((x, j) => j === i ? { ...x, gear: e.target.value } : x))} />
                {preview.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {preview.map((g, k) => (
                      <span key={k} className="rounded border border-[var(--color-border-strong)] px-1.5 py-0.5 text-[11px]">
                        {g.name} → {ROOM_EQUIPMENT_LABELS[g.type]}
                      </span>
                    ))}
                  </div>
                )}
                <input name="roomReview" value={row.review} placeholder="후기 요약 (선택)" className={input}
                  onChange={(e) => setRooms(rooms.map((x, j) => j === i ? { ...x, review: e.target.value } : x))} />
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setRooms([...rooms, { name: "", price: "", capacity: "", gear: "", review: "" }])}
          className="mt-3 text-sm border border-[var(--color-border-strong)] px-3 py-1">+ 방 추가</button>
      </fieldset>

      <button type="submit" className={buttonClasses("primary")}>{submitLabel}</button>
    </form>
  );
}
