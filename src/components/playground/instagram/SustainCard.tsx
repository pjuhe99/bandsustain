"use client";
import type { AnalysisResult } from "@/lib/playground/instagram/types";

export default function SustainCard({ sustain }: { sustain: AnalysisResult["sustain"] }) {
  return <p className="text-xs">{sustain.following ? "서스테인 팔로우 중" : "서스테인 미팔로우"}</p>;
}
