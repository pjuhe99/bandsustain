"use client";
import { useCallback, useEffect, useState } from "react";
import { analyzeZip } from "@/lib/playground/instagram/analyzeZip";
import { saveHistoryEntry } from "@/lib/playground/instagram/history";
import { AnalysisError, type AnalysisResult } from "@/lib/playground/instagram/types";
import IntroScreen from "./IntroScreen";
import GuideSteps from "./GuideSteps";
import UploadDropzone from "./UploadDropzone";
import ResultView from "./ResultView";

type Step = "intro" | "guide" | "upload" | "analyzing" | "result";

const ERROR_MESSAGES: Record<string, string> = {
  NOT_ZIP: "ZIP 형식의 인스타그램 내보내기 파일을 올려 주세요.",
  TOO_LARGE:
    "파일 용량이 너무 커요. 인스타그램 내보내기 설정에서 '팔로워 및 팔로잉' 정보만 선택해 다시 받아 주세요.",
  ENCRYPTED_ZIP: "암호가 설정된 ZIP 파일은 분석할 수 없어요.",
  FILES_NOT_FOUND:
    "팔로워 및 팔로잉 파일을 찾지 못했어요. 인스타그램에서 '팔로워 및 팔로잉', '전체 기간', 'HTML'을 선택했는지 확인해 주세요.",
  PARSE_FAILED: "인스타그램 파일 형식이 변경되어 일부 정보를 읽지 못했어요.",
};

export default function InstagramFollowClient() {
  const [step, setStep] = useState<Step>("intro");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 결과가 메모리에만 있으므로 새로고침 경고
  useEffect(() => {
    if (step !== "result") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setStep("analyzing");
    try {
      const r = await analyzeZip(file);
      saveHistoryEntry(r);
      setResult(r);
      setStep("result");
    } catch (e) {
      setError(
        e instanceof AnalysisError
          ? ERROR_MESSAGES[e.code]
          : "분석 중 문제가 발생했어요. 다시 시도해 주세요.",
      );
      setStep("upload");
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null); // 파싱 결과를 메모리에서 정리
    setError(null);
    setStep("intro");
  }, []);

  if (step === "intro")
    return <IntroScreen onStart={() => setStep("guide")} onSkipToUpload={() => setStep("upload")} />;
  if (step === "guide")
    return <GuideSteps onDone={() => setStep("upload")} onBackToIntro={() => setStep("intro")} />;
  if (step === "upload" || step === "analyzing")
    return (
      <UploadDropzone
        busy={step === "analyzing"}
        error={error}
        onFile={handleFile}
        onBack={() => setStep("guide")}
      />
    );
  return result ? <ResultView result={result} onReset={reset} /> : null;
}
