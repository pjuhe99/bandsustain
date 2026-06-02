"use client";
import { useActionState, useState } from "react";
import { buttonClasses } from "@/components/Button";
import {
  EQUIPMENT_TYPES, EQUIPMENT_LABELS, STUDIO_STATUSES, type Studio,
} from "@/lib/playground/rehearsal/types";
import type { FormState } from "@/app/admin/(authed)/rehearsal-studios/actions";

type Region = { id: number; displayName: string };
type EquipRow = { type: string; name: string; qty: number };

export default function RehearsalStudioForm({
  studio, regions, action, submitLabel,
}: {
  studio?: Studio;
  regions: Region[];
  action: (p: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [rows, setRows] = useState<EquipRow[]>(
    studio?.equipment.map((e) => ({ type: e.equipmentType, name: e.equipmentName ?? "", qty: e.quantity })) ?? [],
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
        <div><label className={label}>시간당 최저가</label>
          <input name="hourlyPriceMin" type="number" defaultValue={studio?.hourlyPriceMin ?? ""} className={input} /></div>
        <div><label className={label}>시간당 최고가</label>
          <input name="hourlyPriceMax" type="number" defaultValue={studio?.hourlyPriceMax ?? ""} className={input} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className={label}>최소 인원</label>
          <input name="minCapacity" type="number" defaultValue={studio?.minCapacity ?? ""} className={input} /></div>
        <div><label className={label}>최대 인원</label>
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

      {/* 장비 동적 행 */}
      <fieldset className="border border-[var(--color-border)] p-4">
        <legend className="text-xs uppercase tracking-wider px-2">보유 장비</legend>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_80px_40px] gap-2 items-center">
              <select name="equipmentType" defaultValue={row.type} className={input}>
                {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{EQUIPMENT_LABELS[t]}</option>)}
              </select>
              <input name="equipmentName" defaultValue={row.name} placeholder="모델명(선택)" className={input} />
              <input name="equipmentQty" type="number" min="1" defaultValue={row.qty} className={input} />
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="text-red-600 text-sm">✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRows([...rows, { type: "DRUM_SET", name: "", qty: 1 }])}
          className="mt-3 text-sm border border-[var(--color-border-strong)] px-3 py-1">+ 장비 추가</button>
      </fieldset>

      <button type="submit" className={buttonClasses("primary")}>{submitLabel}</button>
    </form>
  );
}
