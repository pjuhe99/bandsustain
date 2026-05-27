import { decodeShareProfile } from "@/lib/soundTaste/share";
import { renderShareImage } from "@/lib/soundTaste/shareImage";

// 카카오톡 피드용 정사각형(1200×1200) 공유 이미지. 와이드 og:image 는 카톡이
// 잘라 보여줘서 카카오 공유에는 이 정사각형 이미지를 imageUrl 로 넘긴다.
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ data: string }> },
) {
  const { data } = await params;
  // ImageResponse 는 Response 의 서브클래스라 그대로 반환. 디코드 실패는 폴백.
  return renderShareImage(decodeShareProfile(data), "kakao");
}
