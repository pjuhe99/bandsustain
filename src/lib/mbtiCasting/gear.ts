// src/lib/mbtiCasting/gear.ts
import type { BudgetId, GenreId, PositionId } from "./types";

export interface GearItem {
  category: string;
  name: string;
  reason: string;
}

export interface GearBundle {
  position: PositionId;
  budget: BudgetId;
  items: GearItem[];
  guide: string;
}

const commonNotice =
  "제품명은 탐색을 돕기 위한 예시이며, 구매 전 가격과 재고, 중고 시세를 확인해 주세요.";

export const GEAR_NOTICE = commonNotice;

export const GEAR_BUNDLES: GearBundle[] = [
  // VOCAL
  {
    position: "vocal", budget: "browse",
    items: [
      { category: "마이크", name: "다이내믹 보컬 마이크 유형", reason: "합주실과 공연에서 가장 기본이 되는 마이크 유형을 먼저 알아보세요." },
      { category: "연습", name: "유선 이어폰 또는 헤드폰", reason: "원곡과 자신의 목소리를 비교하며 연습하기 좋아요." },
      { category: "필수품", name: "마이크 케이블·스탠드", reason: "실제 합주 환경을 상상하는 데 필요한 기본 구성입니다." },
    ],
    guide: "먼저 합주실의 대여 마이크를 사용해 보며 본인의 음역과 손에 맞는 형태를 확인해 보세요.",
  },
  {
    position: "vocal", budget: "under300",
    items: [
      { category: "마이크", name: "Shure SM58 또는 동급 다이내믹 마이크", reason: "합주와 라이브 용도로 널리 사용되는 기본 선택지예요." },
      { category: "케이블", name: "XLR 마이크 케이블", reason: "마이크와 믹서 또는 오디오 인터페이스 연결에 필요해요." },
      { category: "관리", name: "마이크 파우치·윈드스크린", reason: "휴대와 위생 관리를 돕는 간단한 액세서리예요." },
    ],
    guide: "집에서 녹음까지 원한다면 다음 단계에서 오디오 인터페이스를 추가하는 방식이 좋아요.",
  },
  {
    position: "vocal", budget: "under600",
    items: [
      { category: "마이크", name: "Shure SM58 또는 sE V7 계열", reason: "라이브용 보컬 마이크를 중심으로 시작할 수 있어요." },
      { category: "녹음", name: "입문형 오디오 인터페이스", reason: "집에서 보컬 녹음과 모니터링을 해볼 수 있어요." },
      { category: "모니터링", name: "밀폐형 헤드폰", reason: "반주를 들으며 자신의 목소리를 체크하기 좋아요." },
    ],
    guide: "합주 중심인지 홈레코딩 중심인지에 따라 마이크와 인터페이스 예산 비중을 조정하세요.",
  },
  {
    position: "vocal", budget: "under1000",
    items: [
      { category: "마이크", name: "라이브용 다이내믹 마이크 + 예비 케이블", reason: "공연과 리허설에서 안정적으로 사용할 구성입니다." },
      { category: "녹음", name: "오디오 인터페이스 + DAW 구성", reason: "데모 녹음과 보컬 편집까지 확장할 수 있어요." },
      { category: "모니터링", name: "스튜디오 헤드폰 또는 모니터 스피커", reason: "연습과 녹음 결과를 더 세밀하게 확인할 수 있어요." },
    ],
    guide: "마이크 하나의 등급보다 녹음·모니터링 환경 전체의 균형을 우선해 보세요.",
  },
  {
    position: "vocal", budget: "owned",
    items: [
      { category: "확장", name: "보컬 이펙터 또는 루퍼", reason: "라이브에서 코러스·공간계 표현을 넓힐 수 있어요." },
      { category: "관리", name: "예비 XLR 케이블", reason: "합주와 공연에서 가장 실용적인 백업입니다." },
      { category: "성장", name: "홈레코딩 세팅 점검", reason: "자신의 보컬을 기록하며 개선점을 확인할 수 있어요." },
    ],
    guide: "이미 장비가 있다면 새로운 구매보다 녹음과 라이브 활용도를 높이는 확장을 추천해요.",
  },

  // LEAD GUITAR
  {
    position: "leadGuitar", budget: "browse",
    items: [
      { category: "기타", name: "일렉트릭 기타: HSS 또는 HH 픽업 유형", reason: "여러 장르의 리드 톤을 탐색하기 좋은 형태예요." },
      { category: "사운드", name: "모델링 앰프 또는 멀티이펙터 유형", reason: "클린부터 드라이브 톤까지 비교해 볼 수 있어요." },
      { category: "필수품", name: "피크·튜너·스트랩", reason: "첫 연주에 반드시 필요한 기본 도구입니다." },
    ],
    guide: "기타는 외형만큼 넥을 잡았을 때의 편안함이 중요하므로 직접 잡아보는 것을 권해요.",
  },
  {
    position: "leadGuitar", budget: "under300",
    items: [
      { category: "기타", name: "입문형 일렉트릭 기타", reason: "중고 또는 입문 패키지에서 먼저 연주감을 확인하기 좋아요." },
      { category: "연습", name: "헤드폰 앰프 또는 미니 연습 앰프", reason: "작은 공간에서 기본 톤을 들으며 연습할 수 있어요." },
      { category: "필수품", name: "클립 튜너·피크·스트랩·케이블", reason: "기타를 바로 연주하기 위한 최소 구성입니다." },
    ],
    guide: "예산이 제한적이면 기타 상태와 셋업을 우선하고, 이펙터는 나중에 확장해도 좋아요.",
  },
  {
    position: "leadGuitar", budget: "under600",
    items: [
      { category: "기타", name: "Squier / Yamaha Pacifica / Ibanez 입문 라인 계열", reason: "록과 팝을 폭넓게 경험하기 좋은 후보군이에요." },
      { category: "앰프", name: "소형 모델링 앰프", reason: "여러 드라이브 톤과 공간계 이펙트를 연습할 수 있어요." },
      { category: "필수품", name: "튜너·스트랩·케이블·여분 피크", reason: "합주까지 가져가기 좋은 기본 세트입니다." },
    ],
    guide: "리드 기타는 기타 본체와 앰프 톤이 함께 중요하므로 둘의 예산 균형을 맞춰보세요.",
  },
  {
    position: "leadGuitar", budget: "under1000",
    items: [
      { category: "기타", name: "중급형 HSS 또는 HH 일렉트릭 기타", reason: "장르에 맞는 픽업 구성과 연주감을 선택할 여유가 생겨요." },
      { category: "사운드", name: "모델링 앰프 또는 멀티이펙터", reason: "합주와 녹음에서 리드 톤을 저장하고 재현하기 쉬워요." },
      { category: "관리", name: "페달보드 기초 구성·케이블·튜너", reason: "무대에서 안정적인 세팅을 준비할 수 있어요." },
    ],
    guide: "좋아하는 기타리스트의 톤이 싱글코일인지 험버커인지 먼저 확인하면 선택이 쉬워집니다.",
  },
  {
    position: "leadGuitar", budget: "owned",
    items: [
      { category: "톤 확장", name: "오버드라이브·딜레이·리버브", reason: "솔로의 질감과 공간감을 더 세밀하게 만들 수 있어요." },
      { category: "편의", name: "페달보드 또는 멀티이펙터 프리셋 정리", reason: "곡마다 빠르게 톤을 전환하기 좋아요." },
      { category: "관리", name: "현·케이블·셋업 점검", reason: "새 장비보다 연주 컨디션 개선 효과가 클 수 있어요." },
    ],
    guide: "이미 기타가 있다면 좋아하는 곡 3곡의 톤을 재현하는 방향으로 확장해 보세요.",
  },

  // RHYTHM GUITAR
  {
    position: "rhythmGuitar", budget: "browse",
    items: [
      { category: "기타", name: "일렉트릭 기타: 스트로크가 편한 바디 유형", reason: "코드와 리듬 연주를 오래 해도 편한지가 중요해요." },
      { category: "연습", name: "클린·크런치 톤을 지원하는 연습 앰프", reason: "코드가 또렷하게 들리는 톤을 익히기 좋아요." },
      { category: "필수품", name: "메트로놈 앱·피크·튜너", reason: "리듬 정확도를 기르는 기본 도구입니다." },
    ],
    guide: "리듬 기타는 화려한 장비보다 박자와 코드 뮤트 연습이 가장 크게 들립니다.",
  },
  {
    position: "rhythmGuitar", budget: "under300",
    items: [
      { category: "기타", name: "입문형 일렉트릭 기타 또는 중고 기타", reason: "파워코드와 스트로크를 시작하기 충분한 구성입니다." },
      { category: "연습", name: "헤드폰 앰프·미니 앰프", reason: "기본적인 클린과 드라이브 톤을 연습할 수 있어요." },
      { category: "필수품", name: "튜너·케이블·여분 피크", reason: "정확한 튜닝과 안정적인 연습을 도와줘요." },
    ],
    guide: "첫 합주를 목표로 한다면 예산 안에서 튜닝 안정성과 넥 상태를 우선하세요.",
  },
  {
    position: "rhythmGuitar", budget: "under600",
    items: [
      { category: "기타", name: "Squier / Yamaha Pacifica 계열 기타", reason: "팝펑크와 J-ROCK 코드 연주에 무난하게 접근할 수 있어요." },
      { category: "앰프", name: "소형 모델링 앰프", reason: "곡에 따라 클린·크런치·하이게인을 바꿔 연습할 수 있어요." },
      { category: "필수품", name: "스트랩·튜너·케이블·카포", reason: "다양한 커버곡 합주에 활용하기 좋아요." },
    ],
    guide: "리듬 사운드는 게인을 과하게 올리기보다 코드가 분명히 들리는 세팅부터 찾는 것이 좋아요.",
  },
  {
    position: "rhythmGuitar", budget: "under1000",
    items: [
      { category: "기타", name: "취향에 맞는 중급 일렉트릭 기타", reason: "오래 연주할 넥감과 픽업 특성을 선택할 수 있어요." },
      { category: "사운드", name: "멀티이펙터 또는 모델링 앰프", reason: "공연곡별 리듬 톤을 일관되게 준비하기 좋아요." },
      { category: "보조", name: "튜너 페달·예비 케이블", reason: "합주와 공연에서 빠르고 안정적으로 대응할 수 있어요." },
    ],
    guide: "합주에서 리듬 기타는 음량보다 중역대와 타이밍이 중요하므로 톤 세팅도 함께 연습하세요.",
  },
  {
    position: "rhythmGuitar", budget: "owned",
    items: [
      { category: "톤 확장", name: "오버드라이브 또는 앰프 시뮬레이션", reason: "곡마다 필요한 크런치 질감을 섬세하게 맞출 수 있어요." },
      { category: "연습", name: "루퍼 또는 메트로놈 활용", reason: "자신의 코드 리듬 흔들림을 점검하기 좋아요." },
      { category: "관리", name: "현 교체·인트로네이션 점검", reason: "코드의 선명도가 크게 달라질 수 있어요." },
    ],
    guide: "기존 장비로 녹음해 들어보면 리듬의 장단점이 가장 빠르게 보입니다.",
  },

  // BASS
  {
    position: "bass", budget: "browse",
    items: [
      { category: "베이스", name: "Jazz Bass 또는 Precision Bass 유형", reason: "좋아하는 저음의 성격을 비교해 보기 좋은 대표 유형이에요." },
      { category: "연습", name: "베이스 전용 앰프 또는 헤드폰 연결 방식", reason: "저음 재생이 가능한 환경에서 연습하는 것이 중요해요." },
      { category: "필수품", name: "튜너·스트랩·케이블", reason: "첫 합주까지 이어지는 기본 준비물입니다." },
    ],
    guide: "베이스는 무게와 넥의 편안함이 중요하므로 가능하면 직접 메어보고 선택하세요.",
  },
  {
    position: "bass", budget: "under300",
    items: [
      { category: "베이스", name: "입문형 또는 상태 좋은 중고 베이스", reason: "기본 핑거링과 루트 연주를 시작하기 충분해요." },
      { category: "연습", name: "베이스 헤드폰 앰프 또는 소형 베이스 앰프", reason: "저음을 확인하며 조용히 연습할 수 있어요." },
      { category: "필수품", name: "클립 튜너·스트랩·케이블", reason: "합주 준비를 위한 최소 세트입니다." },
    ],
    guide: "낮은 예산에서는 잡음, 넥 상태, 프렛 버징 여부를 특히 확인하세요.",
  },
  {
    position: "bass", budget: "under600",
    items: [
      { category: "베이스", name: "Squier / Yamaha / Ibanez 입문 베이스 계열", reason: "J-ROCK부터 시티팝까지 폭넓게 시도할 후보군이에요." },
      { category: "앰프", name: "소형 베이스 연습 앰프", reason: "기타 앰프보다 저음을 안정적으로 확인할 수 있어요." },
      { category: "필수품", name: "튜너·스트랩·케이블·헤드폰", reason: "집 연습과 첫 합주 모두에 유용해요." },
    ],
    guide: "밝고 선명한 저음을 원하면 Jazz Bass 계열, 단단한 중심음을 원하면 Precision 계열을 살펴보세요.",
  },
  {
    position: "bass", budget: "under1000",
    items: [
      { category: "베이스", name: "중급형 Jazz/P Bass 또는 액티브 베이스", reason: "장르와 손에 맞는 음색·연주감을 더 구체적으로 고를 수 있어요." },
      { category: "앰프", name: "충분한 출력의 연습·소규모 합주용 베이스 앰프", reason: "저음의 다이내믹을 제대로 느끼며 연습할 수 있어요." },
      { category: "톤", name: "컴프레서 또는 프리앰프 탐색", reason: "합주 안에서 저음을 더 고르게 정리하는 데 도움을 줘요." },
    ],
    guide: "장비 업그레이드 전, 좋아하는 곡의 베이스 라인을 녹음해 본인의 필요한 톤을 먼저 확인하세요.",
  },
  {
    position: "bass", budget: "owned",
    items: [
      { category: "톤 확장", name: "컴프레서·프리앰프·DI", reason: "합주와 녹음에서 저음의 존재감을 안정적으로 만들 수 있어요." },
      { category: "관리", name: "현 교체와 셋업 점검", reason: "저음의 선명함과 손맛을 크게 개선할 수 있어요." },
      { category: "성장", name: "오디오 인터페이스로 라인 녹음", reason: "타이밍과 뮤트 상태를 확인하기 좋아요." },
    ],
    guide: "베이스는 합주 녹음을 들어볼 때 장비 확장 방향이 가장 선명해집니다.",
  },

  // DRUMS
  {
    position: "drums", budget: "browse",
    items: [
      { category: "연습", name: "연습 패드와 스틱", reason: "공간 제약 없이 기본 스트로크를 경험할 수 있어요." },
      { category: "리듬", name: "메트로놈 앱", reason: "드럼의 핵심인 안정적인 박자를 기르는 도구예요." },
      { category: "체험", name: "합주실 드럼 대여", reason: "실제 킷을 구매하기 전 포지션의 재미를 확인할 수 있어요." },
    ],
    guide: "드럼은 먼저 패드와 합주실 체험으로 시작하면 비용과 공간 부담을 크게 줄일 수 있어요.",
  },
  {
    position: "drums", budget: "under300",
    items: [
      { category: "연습", name: "연습 패드·스틱·스탠드", reason: "손의 기본기와 리듬을 꾸준히 익히기 좋은 구성입니다." },
      { category: "리듬", name: "메트로놈 또는 리듬 연습 앱", reason: "정확한 템포 유지 훈련에 필요해요." },
      { category: "체험", name: "합주실 정기 연습 예산", reason: "실제 드럼 셋에서 풋워크와 합주감을 익힐 수 있어요." },
    ],
    guide: "첫 구매는 드럼 셋보다 연습 패드와 실제 합주 경험에 투자하는 편이 현실적일 수 있어요.",
  },
  {
    position: "drums", budget: "under600",
    items: [
      { category: "연습", name: "고급 연습 패드·스틱·킥 연습 패드", reason: "손과 발의 기본기를 함께 발전시킬 수 있어요." },
      { category: "전자드럼", name: "중고 또는 입문형 전자드럼 탐색", reason: "거주 환경과 소음 조건에 맞으면 곡 연습 범위가 넓어져요." },
      { category: "모니터링", name: "헤드폰", reason: "전자드럼 또는 연습 트랙과 함께 활용하기 좋아요." },
    ],
    guide: "전자드럼은 설치 공간, 진동 전달, 페달 소음을 구매 전에 꼭 확인하세요.",
  },
  {
    position: "drums", budget: "under1000",
    items: [
      { category: "전자드럼", name: "입문~중급 전자드럼 세트", reason: "집에서 곡 단위 연습과 녹음 연동을 시도할 수 있어요." },
      { category: "액세서리", name: "드럼 의자·헤드폰·매트", reason: "장시간 연습의 안정성과 진동 완화에 도움을 줘요." },
      { category: "성장", name: "합주실 연습 병행", reason: "전자드럼과 실제 어쿠스틱 드럼의 차이를 익힐 수 있어요." },
    ],
    guide: "전자드럼만으로 끝내기보다 정기적으로 실제 킷을 연주하면 합주 적응이 빨라요.",
  },
  {
    position: "drums", budget: "owned",
    items: [
      { category: "관리", name: "스틱·튜닝키·소모품 점검", reason: "합주 중 갑작스러운 문제를 줄여줘요." },
      { category: "확장", name: "더블 페달 또는 추가 패드 탐색", reason: "메탈이나 다양한 리듬 스타일로 확장하기 좋아요." },
      { category: "녹음", name: "연습 녹음 환경", reason: "타이밍과 필인의 균형을 객관적으로 들을 수 있어요." },
    ],
    guide: "이미 연주한다면 새 장비보다 연습 녹음과 장르별 테크닉 확장이 먼저일 수 있어요.",
  },

  // KEYBOARD
  {
    position: "keyboard", budget: "browse",
    items: [
      { category: "건반", name: "터치 감도 지원 키보드 또는 MIDI 키보드 유형", reason: "피아노 중심인지 신스 중심인지 취향을 살펴볼 수 있어요." },
      { category: "음색", name: "소프트웨어 신스·무료 음색 탐색", reason: "좋아하는 공간감과 패드 사운드를 찾아보기 좋아요." },
      { category: "연습", name: "헤드폰", reason: "음색을 집중해서 들으며 연습할 수 있어요." },
    ],
    guide: "밴드에서 키보드는 피아노 연주와 신스 음색 설계 중 어느 쪽이 끌리는지 먼저 확인해 보세요.",
  },
  {
    position: "keyboard", budget: "under300",
    items: [
      { category: "건반", name: "소형 MIDI 키보드 또는 입문용 키보드", reason: "컴퓨터와 함께 음색을 탐색하거나 기본 코드 연습을 시작할 수 있어요." },
      { category: "소프트웨어", name: "무료 DAW·가상악기", reason: "패드와 신스 사운드를 비용 부담 없이 경험할 수 있어요." },
      { category: "모니터링", name: "헤드폰", reason: "집에서 조용히 음색과 코드 진행을 확인해요." },
    ],
    guide: "MIDI 키보드는 단독으로 소리가 나지 않는 제품도 있으므로 사용 환경을 먼저 확인하세요.",
  },
  {
    position: "keyboard", budget: "under600",
    items: [
      { category: "건반", name: "터치 감도 지원 키보드 또는 MIDI 컨트롤러", reason: "코드와 멜로디의 표현력을 키우며 시작하기 좋아요." },
      { category: "연결", name: "오디오 인터페이스 또는 필요한 케이블", reason: "컴퓨터 기반 음색과 녹음으로 확장할 수 있어요." },
      { category: "음색", name: "신스·패드 가상악기 탐색", reason: "시티팝과 J-POP의 색채를 만들어볼 수 있어요." },
    ],
    guide: "라이브 합주 목적이라면 컴퓨터 없이도 음색을 불러올 수 있는지 확인하세요.",
  },
  {
    position: "keyboard", budget: "under1000",
    items: [
      { category: "건반", name: "공연 활용 가능한 키보드 또는 신시사이저", reason: "프리셋과 음색 전환을 무대에서 활용하기 좋아요." },
      { category: "모니터링", name: "헤드폰·스탠드·페달", reason: "연주 환경을 안정적으로 구성해 줘요." },
      { category: "녹음", name: "오디오 인터페이스 또는 DAW 연동", reason: "곡의 레이어를 직접 만들고 기록할 수 있어요." },
    ],
    guide: "건반 수, 무게, 라이브 음색 전환 편의성을 함께 비교하면 후회가 적어요.",
  },
  {
    position: "keyboard", budget: "owned",
    items: [
      { category: "확장", name: "신스 플러그인 또는 하드웨어 신스 탐색", reason: "본인만의 사운드 팔레트를 넓힐 수 있어요." },
      { category: "공연", name: "서스테인 페달·스탠드·케이블 정리", reason: "라이브 세팅의 안정감을 높여줘요." },
      { category: "창작", name: "DAW 템플릿과 프리셋 정리", reason: "곡 아이디어를 빠르게 기록하고 재현하기 좋아요." },
    ],
    guide: "이미 장비가 있다면 결과 캐릭터의 분위기에 맞춘 프리셋 묶음을 만들어 보세요.",
  },
];

export const GENRE_GEAR_TIPS: Record<GenreId, Partial<Record<PositionId, string>>> = {
  jPop: {
    vocal: "선명한 보컬과 공간계 표현이 잘 어울려요.",
    leadGuitar: "클린 톤과 적당한 코러스·딜레이를 탐색해 보세요.",
    rhythmGuitar: "또렷한 코드가 들리는 밝은 톤이 잘 어울려요.",
    bass: "선명한 어택과 정돈된 저음을 찾아보세요.",
    drums: "섬세한 다이내믹과 정확한 템포가 중요해요.",
    keyboard: "피아노, 브라스, 반짝이는 신스 레이어를 조합해 보세요.",
  },
  jRock: {
    vocal: "후렴에서 힘 있게 뻗는 라이브 보컬 사운드를 상상해 보세요.",
    leadGuitar: "드라이브 톤과 딜레이로 질주하는 솔로를 만들어 보세요.",
    rhythmGuitar: "코드가 뭉개지지 않는 크런치 톤이 핵심이에요.",
    bass: "기타와 드럼 사이에서 또렷하게 움직이는 저음이 잘 어울려요.",
    drums: "스네어의 추진력과 심벌의 시원한 에너지를 살려보세요.",
    keyboard: "필요한 순간 곡을 확장하는 패드와 피아노가 잘 맞아요.",
  },
  popPunk: {
    vocal: "관객이 함께 부르기 좋은 직관적인 에너지가 중요해요.",
    leadGuitar: "간결한 드라이브 톤과 기억에 남는 짧은 리드를 찾아보세요.",
    rhythmGuitar: "파워코드가 시원하게 들리는 톤을 우선해 보세요.",
    bass: "빠른 곡에서도 단단하게 따라가는 저음을 준비해 보세요.",
    drums: "안정적인 빠른 비트와 강한 스네어가 잘 어울려요.",
    keyboard: "필요한 경우 포인트 음색으로만 가볍게 더해보세요.",
  },
  alternative: {
    vocal: "섬세함과 폭발감이 함께 가능한 표현을 찾아보세요.",
    leadGuitar: "퍼즈, 리버브, 독특한 질감의 톤이 매력적이에요.",
    rhythmGuitar: "거친 코드 질감과 다이내믹 대비를 살려보세요.",
    bass: "곡의 어두운 무게 중심을 만드는 저음을 탐색해 보세요.",
    drums: "절제된 구간과 터지는 구간의 대비가 중요해요.",
    keyboard: "노이즈·패드·공간계 음색으로 분위기를 확장해 보세요.",
  },
  indieRock: {
    vocal: "완벽한 기교보다 본인만의 자연스러운 톤이 잘 어울려요.",
    leadGuitar: "클린이나 로우게인 톤의 섬세한 질감을 탐색해 보세요.",
    rhythmGuitar: "가벼운 스트로크와 편안한 코드 사운드가 좋아요.",
    bass: "노래와 자연스럽게 걸어가는 그루브를 우선해 보세요.",
    drums: "과하지 않은 비트로 곡의 여백을 살려주세요.",
    keyboard: "작은 포인트 음색만으로도 무드가 크게 달라질 수 있어요.",
  },
  cityPop: {
    vocal: "부드럽고 세련된 프레이징을 살릴 모니터링 환경이 좋아요.",
    leadGuitar: "클린 톤, 컴프, 코러스 계열 질감을 살펴보세요.",
    rhythmGuitar: "커팅 연주가 선명하게 들리는 클린 톤이 잘 맞아요.",
    bass: "부드럽지만 존재감 있는 그루브가 핵심이에요.",
    drums: "박자를 밀고 당기는 듯한 매끄러운 그루브를 연습해 보세요.",
    keyboard: "일렉트릭 피아노와 레트로 신스 음색이 잘 어울려요.",
  },
  metalHeavyRock: {
    vocal: "강한 표현을 시도할 때에도 무리 없는 발성과 모니터링을 우선하세요.",
    leadGuitar: "험버커 계열과 하이게인 톤을 탐색하기 좋아요.",
    rhythmGuitar: "두터운 리프가 분명히 들리는 하이게인 세팅이 잘 맞아요.",
    bass: "강한 기타 사이에서도 어택이 살아 있는 저음을 찾아보세요.",
    drums: "빠른 킥과 강한 타격을 연습하기 위한 환경을 고려해 보세요.",
    keyboard: "웅장한 패드나 전자적 레이어로 헤비한 사운드를 넓힐 수 있어요.",
  },
};

export function getGearBundle(position: PositionId, budget: BudgetId): GearBundle {
  const found = GEAR_BUNDLES.find(
    (bundle) => bundle.position === position && bundle.budget === budget,
  );
  if (!found) {
    throw new Error(`Gear bundle missing: ${position}/${budget}`);
  }
  return found;
}
