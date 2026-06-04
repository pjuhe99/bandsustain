import { lineColor } from "@/lib/playground/rehearsal/metroLineColors";

export default function LineBadge({ line }: { line: string }) {
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold text-white align-middle"
      style={{ backgroundColor: lineColor(line) }}>{line}</span>
  );
}
