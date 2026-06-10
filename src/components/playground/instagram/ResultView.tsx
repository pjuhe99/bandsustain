"use client";
import type { AnalysisResult } from "@/lib/playground/instagram/types";

export default function ResultView(props: { result: AnalysisResult; onReset: () => void }) {
  return <pre className="text-xs">{JSON.stringify(props.result.sustain, null, 2)}</pre>;
}
