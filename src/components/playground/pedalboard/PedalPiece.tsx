"use client";
import Image from "next/image";

export interface PieceProps {
  x: number; y: number; rot: number; widthIn: number; heightIn: number;
  selected: boolean; brand: string; name: string;
  imageFilename: string | null;
  pxPerIn: number;
  onPointerDown: (e: React.PointerEvent) => void;
}

export function PedalPiece(props: PieceProps) {
  const { x, y, rot, widthIn, heightIn, pxPerIn, selected, imageFilename, brand, name, onPointerDown } = props;
  const wPx = widthIn * pxPerIn;
  const hPx = heightIn * pxPerIn;
  return (
    <button type="button" onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left: x * pxPerIn,
        top: y * pxPerIn,
        width: wPx,
        height: hPx,
        transform: `rotate(${rot}deg)`,
        transformOrigin: "center center",
        touchAction: "none",
        border: selected ? "2px solid #2563FF" : "1px solid rgba(0,0,0,0.2)",
        background: "transparent",
        padding: 0,
      }}
      aria-label={`${brand} ${name}`}
    >
      {imageFilename ? (
        <Image src={`/playground/images/pedals/${imageFilename}`} alt={`${brand} ${name}`}
          fill className="object-contain pointer-events-none" sizes="200px"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] pointer-events-none">{name}</span>
      )}
    </button>
  );
}
