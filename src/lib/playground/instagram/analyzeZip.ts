import JSZip from "jszip";
import { MAX_ZIP_BYTES, SUSTAIN_USERNAME } from "./config";
import { matchConnectionFiles } from "./findFiles";
import { parseConnectionsHtml } from "./parseConnectionsHtml";
import { calculateRelations } from "./relations";
import { AnalysisError, type AnalysisResult, type InstagramConnection } from "./types";

async function isZipSignature(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05);
}

export async function analyzeZip(file: File): Promise<AnalysisResult> {
  if (file.size > MAX_ZIP_BYTES) throw new AnalysisError("TOO_LARGE");
  if (!(await isZipSignature(file))) throw new AnalysisError("NOT_ZIP");

  let zip: JSZip;
  try {
    // arrayBuffer()로 변환: 일부 환경에서 File→Blob 미인식 우회 (Node 20 테스트 환경 등)
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new AnalysisError("NOT_ZIP");
  }

  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  const found = matchConnectionFiles(paths);
  if (found.followers.length === 0 && !found.following) {
    // 내부 경로는 개발 콘솔에만
    if (process.env.NODE_ENV !== "production") console.debug("zip entries:", paths);
    throw new AnalysisError("FILES_NOT_FOUND");
  }

  const readHtml = async (path: string): Promise<string> => {
    try {
      return await zip.file(path)!.async("string");
    } catch (e) {
      // JSZip은 암호화된 엔트리 해제 미지원 → 읽기 시점 에러
      if (e instanceof Error && /encrypt/i.test(e.message)) {
        throw new AnalysisError("ENCRYPTED_ZIP");
      }
      throw new AnalysisError("PARSE_FAILED");
    }
  };

  let parseFailedCount = 0;
  const followers: InstagramConnection[] = [];
  const dedup = new Set<string>();
  for (const p of found.followers) {
    const out = parseConnectionsHtml(await readHtml(p));
    parseFailedCount += out.failedCount;
    for (const c of out.connections) {
      if (!dedup.has(c.username)) {
        dedup.add(c.username);
        followers.push(c); // 여러 followers_*.html 병합
      }
    }
  }

  let following: InstagramConnection[] = [];
  if (found.following) {
    const out = parseConnectionsHtml(await readHtml(found.following));
    parseFailedCount += out.failedCount;
    following = out.connections;
  }

  const relations = calculateRelations(followers, following);
  const sustainConn = following.find((c) => c.username === SUSTAIN_USERNAME) ?? null;

  return {
    relations,
    hasFollowers: found.followers.length > 0,
    hasFollowing: found.following !== null,
    parseFailedCount,
    sustain: {
      following: sustainConn !== null,
      since: sustainConn?.followedAt ?? null,
      sinceRaw: sustainConn?.followedAtRaw ?? null,
    },
    analyzedAt: new Date().toISOString(),
  };
}
