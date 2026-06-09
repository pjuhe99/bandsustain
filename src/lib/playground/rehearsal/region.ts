// 주소 문자열 → playground_regions 행 정보 도출.
// 입력은 common_address("서울 성북구 동선동1가") 또는 road_address("서울특별시 성북구 동소문로20가길 51")
// 둘 다 처리. display_name 은 기존 시드 포맷("서울 마포구", "경기 성남시")과 일치하도록 "단축시도 + 2단계(구/시)".

export type RegionInfo = {
  province: string; // DB province 컬럼(정식 명칭): "서울특별시", "경기도" ...
  city: string | null; // 도(道) 하위의 시
  district: string | null; // 광역시 하위의 구
  displayName: string; // UNIQUE 키: "서울 마포구", "경기 성남시"
};

// 단축키 → 정식 명칭. 광역/특별시는 2단계가 '구', 도는 2단계가 '시'.
const METRO: Record<string, string> = {
  서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시", 인천: "인천광역시",
  광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시",
};
const PROVINCE: Record<string, string> = {
  경기: "경기도", 강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도",
  전북: "전북특별자치도", 전남: "전라남도", 경북: "경상북도", 경남: "경상남도", 제주: "제주특별자치도",
};

// 토큰[0]("서울"|"서울특별시"|"경기도"...)을 단축키("서울"|"경기")로 정규화.
function normalizeProvinceKey(tok: string): string | null {
  for (const key of [...Object.keys(METRO), ...Object.keys(PROVINCE)]) {
    if (tok.startsWith(key)) return key;
  }
  // 정식명 prefix 매칭 (예: "충청북도" → 충북)
  if (tok.startsWith("충청북")) return "충북";
  if (tok.startsWith("충청남")) return "충남";
  if (tok.startsWith("전라북") || tok.startsWith("전북")) return "전북";
  if (tok.startsWith("전라남")) return "전남";
  if (tok.startsWith("경상북")) return "경북";
  if (tok.startsWith("경상남")) return "경남";
  if (tok.startsWith("강원")) return "강원";
  if (tok.startsWith("제주")) return "제주";
  return null;
}

export function regionFromAddress(address: string | null | undefined): RegionInfo | null {
  const toks = (address ?? "").trim().split(/\s+/).filter(Boolean);
  if (toks.length < 2) return null;
  const key = normalizeProvinceKey(toks[0]);
  if (!key) return null;
  const level2 = toks[1];
  if (!level2) return null;
  const isMetro = key in METRO;
  const province = isMetro ? METRO[key] : PROVINCE[key];
  return {
    province,
    city: isMetro ? null : level2,
    district: isMetro ? level2 : null,
    displayName: `${key} ${level2}`,
  };
}
