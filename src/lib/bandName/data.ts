// 밴드 이름 생성기 — 단어 DB / 패턴 / 가중치 / 선호·차단 조합 / 라벨.
// 1차 버전: 외부 AI 없이 이 데이터만으로 이름을 만든다.

import type {
  Mood,
  Pattern,
  Scene,
  WordCategory,
} from "./types";

// ---------------------------------------------------------------------------
// 한국어 단어 DB
// ---------------------------------------------------------------------------
export const koreanWords: Record<WordCategory, string[]> = {
  time: [
    "새벽", "심야", "한밤", "오후", "자정", "첫차", "막차", "저녁", "아침",
    "노을", "해질녘", "밤", "정오", "주말", "월요일", "금요일", "방과후",
    "여름밤", "열두시", "세시", "네시", "마지막밤", "어젯밤", "내일", "언젠가",
  ],
  season: [
    "봄", "여름", "가을", "겨울", "장마", "초여름", "늦여름", "첫눈", "봄날",
    "한여름", "잔설", "꽃샘", "열대야", "소나기", "벚꽃", "낙엽", "파도",
    "휴가", "방학", "졸업",
  ],
  weather: [
    "비", "소나기", "눈보라", "안개", "바람", "태풍", "구름", "번개", "천둥",
    "폭우", "물결", "서리", "이슬", "빗방울", "먹구름", "산들바람", "잔바람",
    "파랑비", "유성우", "밤비",
  ],
  color: [
    "파랑", "푸른", "초록", "노랑", "보라", "분홍", "회색", "은색", "청록",
    "남색", "검정", "하얀", "주홍", "연두", "빛바랜", "무채색", "투명",
    "새파란", "창백한", "붉은",
  ],
  light: [
    "네온", "형광등", "가로등", "잔광", "불빛", "섬광", "별빛", "달빛",
    "신호등", "전조등", "반딧불", "야광", "백열등", "점멸등", "전광판",
    "빛무리", "스크린", "플래시", "레이저", "불꽃",
  ],
  place: [
    "옥상", "정류장", "비상구", "교차로", "골목", "터널", "육교", "지하도",
    "철길", "운동장", "해변", "방파제", "놀이터", "공원", "광장", "주차장",
    "건널목", "출구", "승강장", "고가도로", "강변", "계단", "횡단보도",
    "후문", "복도", "옥탑", "옥외무대", "폐역", "기차역", "공중전화",
  ],
  city: [
    "서울", "도쿄", "홍대", "신촌", "망원", "합정", "을지로", "오사카",
    "시부야", "신주쿠", "부산", "인천", "성수", "이태원", "한강", "제주",
    "교토", "요코하마", "춘천", "대전",
  ],
  room: [
    "세탁소", "편의점", "연습실", "지하실", "다락방", "교실", "도서관",
    "극장", "호텔", "모텔", "카페", "식당", "문방구", "오락실", "레코드샵",
    "사진관", "수영장", "창고", "작업실", "기숙사", "분식집", "세차장",
    "매표소", "방송실", "휴게실", "노래방", "만화방", "PC방", "구내식당",
    "동아리방",
  ],
  analog: [
    "카세트", "라디오", "필름", "비디오", "테이프", "턴테이블", "레코드",
    "헤드폰", "이어폰", "스피커", "마이크", "기타피크", "앰프", "코드",
    "포스터", "엽서", "편지", "일기장", "사진", "폴라로이드", "전화기",
    "공중전화", "자판기", "동전", "티켓", "영수증", "종이컵", "우산",
    "운동화", "백팩", "교복", "자전거", "스케이트보드", "캘린더", "메모장",
    "스티커", "전단지", "성냥", "열쇠", "라이터",
  ],
  sound: [
    "노이즈", "피드백", "에코", "리버브", "멜로디", "코러스", "리듬", "박자",
    "잔향", "소음", "전파", "주파수", "백색소음", "하울링", "볼륨", "신호",
    "음파", "합창", "진동", "저음", "고음", "왜곡", "잡음", "무음", "숨소리",
    "발소리", "파열음", "사이렌", "휘파람", "박수",
  ],
  nature: [
    "파도", "바다", "구름", "달", "별", "유성", "행성", "은하", "사막", "숲",
    "나무", "잔디", "모래", "나비", "고래", "제비", "고양이", "여우",
    "민들레", "선인장", "해바라기", "장미", "라일락", "물고기", "해파리",
    "조개", "산호", "섬", "절벽", "수평선",
  ],
  emotion: [
    "청춘", "미열", "불면", "잔상", "공백", "망각", "낭만", "고독", "우울",
    "설렘", "질주", "도망", "방황", "착각", "환상", "후회", "미련", "기억",
    "비밀", "약속", "오해", "순간", "상처", "위로", "불안", "농담", "기분",
    "온도", "사춘기", "낙서", "실종", "침묵", "소란", "폭주", "반짝임",
    "눈물", "한숨", "웃음", "열병", "몽상",
  ],
  youth: [
    "소년", "소녀", "청춘", "유령", "친구들", "도망자", "외계인", "낙오자",
    "졸업생", "전학생", "문제아", "불량학생", "방랑자", "관찰자", "여행자",
    "겁쟁이", "몽상가", "초능력자", "낮잠부", "야간반", "지각생", "방송부",
    "합주부", "사진부", "귀가부", "탐험대", "구조대", "응원단", "합창단",
    "생활부",
  ],
  machine: [
    "냉장고", "세탁기", "자판기", "전기밥솥", "선풍기", "에어컨", "복사기",
    "프린터", "계산기", "전동킥보드", "엘리베이터", "에스컬레이터", "리모컨",
    "콘센트", "멀티탭", "배터리", "충전기", "브라운관", "모니터", "키보드",
    "알람시계", "전자레인지", "신호기", "라디오", "모터", "엔진", "스위치",
    "전구", "카메라", "게임기",
  ],
  movement: [
    "질주", "잠수", "비행", "산책", "탈출", "폭주", "표류", "추락", "점프",
    "도망", "여행", "유턴", "직진", "회전", "정지", "출발", "귀가", "가출",
    "등교", "퇴근", "하교", "실종", "충돌", "착륙", "이륙", "우회", "고장",
    "방전", "점멸", "소멸",
  ],
  odd: [
    "양말", "두부", "김밥", "라면", "콜라", "붕어빵", "젤리", "삼각김밥",
    "비누", "칫솔", "수건", "슬리퍼", "우비", "종이봉투", "물티슈",
    "고무장갑", "빨대", "리본", "단추", "지우개", "샤프", "클립",
    "스테이플러", "휴지통", "택배상자", "비닐봉지", "분리수거", "컵라면",
    "계란말이", "마요네즈", "감자튀김", "케첩", "치약", "목도리", "우체통",
    "대걸레", "체육복", "실내화", "출석부", "급식판",
  ],
  food: [
    "김밥", "라면", "떡볶이", "콜라", "사이다", "아메리카노", "삼각김밥",
    "붕어빵", "젤리", "푸딩", "토스트", "감자튀김", "핫도그", "아이스크림",
    "소다", "레몬", "체리", "복숭아", "우유", "멜론", "오렌지", "커피",
    "도넛", "초콜릿", "사탕",
  ],
  suffix: [
    "클럽", "시네마", "레코즈", "호텔", "소년단", "소녀단", "합창단",
    "탐험대", "관측소", "연구회", "방송국", "주식회사", "프로젝트",
    "신드롬", "퍼레이드", "카니발", "오케스트라", "극장", "살롱", "공화국",
    "생활", "동맹", "연합", "구조대", "야간반", "유랑단", "백화점", "상회",
    "서비스센터", "문제집",
  ],

  // --- 메탈 / 헤비록 전용 카테고리 (철·화염·심연·의식·괴수) ---
  metalMaterial: [
    "철", "강철", "쇳물", "철갑", "철권", "철창", "쇠사슬", "사슬", "갑옷",
    "칼날", "검", "대검", "도끼", "망치", "철퇴", "창", "방패", "전차",
    "기관차", "용광로", "제철소", "엔진", "톱니", "기어", "강철문", "탄환",
    "대포", "화약", "철골", "금속성", "쇠파이프", "철탑", "검날", "철마", "철심",
  ],
  doom: [
    "심연", "파멸", "멸망", "종말", "지옥", "화염", "불길", "폭풍", "천둥",
    "번개", "분노", "광기", "저주", "죽음", "절망", "혼돈", "폐허", "재앙",
    "어둠", "암흑", "피", "핏빛", "붉은밤", "전쟁", "학살", "처형", "추락",
    "붕괴", "폭발", "검은불", "잿더미", "비명", "단죄", "복수", "멸절", "잔해",
    "폭군", "전율", "소멸", "악몽",
  ],
  ritual: [
    "제단", "왕관", "교단", "성전", "의식", "묘지", "무덤", "장례식", "성배",
    "성벽", "왕좌", "신전", "성당", "십자가", "문장", "예언", "심판", "기도",
    "성가대", "순례자", "군단", "기사단", "수도회", "황제", "왕국", "제국",
    "사도", "대성당", "장막", "봉인", "계시", "성흔", "탑", "관", "깃발",
  ],
  beast: [
    "용", "검은용", "늑대", "까마귀", "독수리", "뱀", "박쥐", "해골", "악마",
    "괴물", "거인", "전갈", "망령", "유령", "사신", "마왕", "야수", "광견",
    "불사조", "키메라", "미노타우로스", "크라켄", "괴수", "마녀", "망자",
    "좀비", "흡혈귀", "사냥개", "도깨비", "괴인",
  ],
};

// ---------------------------------------------------------------------------
// 영어 단어 DB (+ 펑크/개러지 보강 단어를 같은 카테고리에 병합)
// ---------------------------------------------------------------------------
const englishBase: Partial<Record<WordCategory, string[]>> = {
  time: [
    "MIDNIGHT", "DAWN", "SUNSET", "SUMMER", "WINTER", "SUNDAY", "MONDAY",
    "FRIDAY", "TONIGHT", "AFTERNOON", "TWILIGHT", "LAST NIGHT", "DAYBREAK",
    "BLUE HOUR", "LATE NIGHT",
  ],
  color: [
    "BLUE", "PALE", "NEON", "PINK", "SILVER", "VIOLET", "GREY", "WHITE",
    "BLACK", "AQUA", "FADED", "CLEAR", "GOLDEN", "CRIMSON", "LIME",
    // 펑크 보강
    "DEAD", "BROKEN", "DIRTY", "LOUD", "EMPTY", "CHEAP", "BAD", "LOST",
  ],
  light: [
    "NEON", "FLASH", "MOONLIGHT", "STARLIGHT", "SIGNAL", "HEADLIGHT",
    "DAYLIGHT", "SPARK", "GLOW", "LASER", "STROBE", "SCREEN", "SIGNBOARD",
    "FIREWORK", "NIGHTLIGHT",
  ],
  place: [
    "ROOFTOP", "BASEMENT", "STATION", "EXIT", "TUNNEL", "CROSSROAD", "ALLEY",
    "HIGHWAY", "MOTEL", "HOTEL", "GARAGE", "PLAYGROUND", "BEACH",
    "PARKING LOT", "CLASSROOM", "LAUNDROMAT", "CONVENIENCE STORE", "ARCADE",
    "BUS STOP", "SIDEWALK",
  ],
  analog: [
    "CASSETTE", "RADIO", "POLAROID", "CAMERA", "VINYL", "POSTCARD", "LETTER",
    "TICKET", "HEADPHONE", "SPEAKER", "MICROPHONE", "AMPLIFIER", "UMBRELLA",
    "BICYCLE", "SKATEBOARD", "TELEPHONE", "VIDEOTAPE", "CALENDAR", "STICKER",
    "MATCHBOX",
  ],
  sound: [
    "NOISE", "ECHO", "REVERB", "FEEDBACK", "SIGNAL", "STATIC", "CHORUS",
    "MELODY", "RHYTHM", "SIREN", "VOLUME", "DISTORTION", "WAVE", "SILENCE",
    "FREQUENCY", "WHISTLE", "CLAP", "LOW TONE", "WHITE NOISE", "RADIO WAVE",
    // 펑크 보강
    "SCREAM", "BUZZ", "NO SIGNAL",
  ],
  nature: [
    "OCEAN", "WAVE", "MOON", "STAR", "COMET", "CLOUD", "FOREST", "DESERT",
    "ISLAND", "SUNFLOWER", "CACTUS", "JELLYFISH", "WHALE", "SEAGULL",
    "HORIZON",
  ],
  emotion: [
    "YOUTH", "FEVER", "ROMANCE", "PANIC", "MEMORY", "DREAM", "ESCAPE",
    "RUNAWAY", "HEARTBREAK", "SLEEPLESS", "LONELY", "GOODBYE", "MIRAGE",
    "SECRET", "PROMISE", "SORROW", "FANTASY", "DAYDREAM", "CONFUSION",
    "AFTERIMAGE",
    // 펑크 보강
    "RIOT", "TROUBLE", "CRASH", "BURNOUT", "DISASTER", "BREAKDOWN", "FAILURE",
  ],
  youth: [
    "BOYS", "GIRLS", "KIDS", "GHOSTS", "RUNAWAYS", "DREAMERS", "LOSERS",
    "STRANGERS", "TEENAGERS", "OUTSIDERS", "ALIENS", "TRAVELERS", "STUDENTS",
    "BAD KIDS", "NIGHT CREW",
  ],
  machine: [
    "BATTERY", "MOTOR", "ENGINE", "SWITCH", "MONITOR", "PRINTER", "ELEVATOR",
    "ESCALATOR", "REFRIGERATOR", "WASHING MACHINE", "REMOTE CONTROL",
    "CHARGER", "VENDING MACHINE", "MICROWAVE", "GAME BOY",
  ],
  movement: [
    "DRIVE", "ESCAPE", "RUNAWAY", "DIVE", "CRASH", "FLIGHT", "FLOAT", "FALL",
    "JUMP", "U-TURN", "DEPARTURE", "LANDING", "BREAKDOWN", "DISAPPEAR",
    "BURNOUT",
  ],
  odd: [
    "SOCKS", "TOFU", "NOODLES", "COLA", "JELLY", "TOOTHBRUSH", "SLIPPERS",
    "PAPER CUP", "TRASH CAN", "PLASTIC BAG", "LUNCH BOX", "MAYO", "POTATO",
    "TOWEL", "ERASER",
  ],
  suffix: [
    "CLUB", "CINEMA", "RECORDS", "HOTEL", "ORCHESTRA", "PARADE", "PROJECT",
    "SYNDROME", "SOCIETY", "STATION", "SERVICE", "RADIO", "MOTEL",
    "DEPARTMENT", "UNION",
  ],

  // --- 메탈 / 헤비록 전용 카테고리 ---
  metalMaterial: [
    "IRON", "STEEL", "METAL", "CHAIN", "BLADE", "SWORD", "AXE", "HAMMER",
    "ARMOR", "SHIELD", "FURNACE", "ANVIL", "ENGINE", "GEAR", "TANK", "BULLET",
    "CANNON", "RAZOR", "SPIKE", "THRONE", "MACHINE", "FORGE", "RUST", "NAIL",
    "BARBED WIRE", "WARHAMMER", "STEEL HORSE", "IRON FIST", "METAL HEART",
    "BATTLE AXE",
  ],
  doom: [
    "DOOM", "HELL", "ABYSS", "DEATH", "FIRE", "FLAME", "THUNDER", "STORM",
    "WRATH", "RAGE", "CHAOS", "CURSE", "RUIN", "DISASTER", "DARKNESS", "BLOOD",
    "CRIMSON", "WAR", "SLAUGHTER", "EXECUTION", "FALLEN", "COLLAPSE",
    "EXPLOSION", "BLACK FIRE", "ASHES", "SCREAM", "JUDGEMENT", "REVENGE",
    "NIGHTMARE", "OBLIVION", "APOCALYPSE", "INFERNO", "TORMENT",
    "ANNIHILATION", "BURIAL",
  ],
  ritual: [
    "ALTAR", "CROWN", "CULT", "RITUAL", "GRAVE", "GRAVEYARD", "FUNERAL",
    "CHALICE", "THRONE", "TEMPLE", "CATHEDRAL", "CROSS", "PROPHECY",
    "JUDGEMENT", "PRAYER", "LEGION", "ORDER", "EMPIRE", "KINGDOM", "APOSTLE",
    "REQUIEM", "SEAL", "REVELATION", "BANNER", "CRYPT", "TOMB", "SANCTUARY",
    "CEREMONY", "MONASTERY", "HOLY WAR",
  ],
  beast: [
    "DRAGON", "BLACK DRAGON", "WOLF", "RAVEN", "EAGLE", "SNAKE", "BAT",
    "SKULL", "DEMON", "MONSTER", "GIANT", "SCORPION", "GHOST", "REAPER",
    "BEAST", "PHOENIX", "CHIMERA", "KRAKEN", "WITCH", "VAMPIRE", "ZOMBIE",
    "HELLHOUND", "SERPENT", "GOLEM", "TITAN",
  ],
};

export const englishWords: Partial<Record<WordCategory, string[]>> = englishBase;

// ---------------------------------------------------------------------------
// 한국어 패턴
// ---------------------------------------------------------------------------
export const koreanPatterns: Pattern[] = [
  { id: "ko_time_place", slots: ["time", "place"], separator: "", scenes: ["jrock", "emo", "campus"], moods: ["fresh", "wistful", "romantic"], minWeirdness: 1, maxWeirdness: 3, weight: 14 },
  { id: "ko_season_place", slots: ["season", "place"], separator: "", scenes: ["jrock", "campus", "citypop"], moods: ["fresh", "romantic", "wistful"], minWeirdness: 1, maxWeirdness: 3, weight: 13 },
  { id: "ko_color_place", slots: ["color", "place"], separator: "", scenes: ["jrock", "emo", "hongdae"], moods: ["dreamy", "wistful", "romantic"], minWeirdness: 1, maxWeirdness: 3, weight: 11 },
  { id: "ko_light_place", slots: ["light", "place"], separator: "", scenes: ["citypop", "emo", "punk"], moods: ["dreamy", "rough", "romantic"], minWeirdness: 1, maxWeirdness: 4, weight: 10 },
  { id: "ko_time_analog", slots: ["time", "analog"], separator: "", scenes: ["jrock", "citypop", "emo"], moods: ["wistful", "dreamy", "romantic"], minWeirdness: 1, maxWeirdness: 3, weight: 13 },
  { id: "ko_season_analog", slots: ["season", "analog"], separator: "", scenes: ["jrock", "citypop", "campus"], moods: ["fresh", "romantic"], minWeirdness: 1, maxWeirdness: 3, weight: 11 },
  { id: "ko_emotion_analog", slots: ["emotion", "analog"], separator: "", scenes: ["emo", "jrock", "hongdae"], moods: ["wistful", "dreamy", "romantic"], minWeirdness: 1, maxWeirdness: 4, weight: 10 },
  { id: "ko_sound_analog", slots: ["sound", "analog"], separator: "", scenes: ["emo", "jrock", "punk"], moods: ["dreamy", "rough", "wistful"], minWeirdness: 1, maxWeirdness: 4, weight: 10 },
  { id: "ko_place_youth", slots: ["place", "youth"], separator: "", scenes: ["jrock", "hongdae", "campus"], moods: ["fresh", "wistful", "funny"], minWeirdness: 2, maxWeirdness: 4, weight: 9 },
  { id: "ko_color_youth", slots: ["color", "youth"], separator: "", scenes: ["jrock", "emo", "campus"], moods: ["fresh", "dreamy", "wistful"], minWeirdness: 1, maxWeirdness: 3, weight: 10 },
  { id: "ko_nature_youth", slots: ["nature", "youth"], separator: "", scenes: ["jrock", "hongdae", "campus"], moods: ["fresh", "dreamy", "romantic"], minWeirdness: 2, maxWeirdness: 4, weight: 8 },
  { id: "ko_city_analog", slots: ["city", "analog"], separator: "", scenes: ["jrock", "citypop", "hongdae"], moods: ["dreamy", "romantic", "fresh"], minWeirdness: 1, maxWeirdness: 3, weight: 12 },
  { id: "ko_city_room", slots: ["city", "room"], separator: "", scenes: ["citypop", "hongdae", "jrock"], moods: ["funny", "romantic", "dreamy"], minWeirdness: 2, maxWeirdness: 4, weight: 10 },
  { id: "ko_city_suffix", slots: ["city", "suffix"], separator: "", scenes: ["hongdae", "citypop", "punk"], moods: ["funny", "romantic", "rough"], minWeirdness: 2, maxWeirdness: 4, weight: 8 },
  { id: "ko_room_youth", slots: ["room", "youth"], separator: "", scenes: ["hongdae", "campus", "jrock"], moods: ["funny", "fresh", "wistful"], minWeirdness: 2, maxWeirdness: 5, weight: 8 },
  { id: "ko_room_suffix", slots: ["room", "suffix"], separator: "", scenes: ["hongdae", "punk", "campus"], moods: ["funny", "rough", "fresh"], minWeirdness: 2, maxWeirdness: 5, weight: 8 },
  { id: "ko_analog_suffix", slots: ["analog", "suffix"], separator: "", scenes: ["hongdae", "citypop", "jrock"], moods: ["funny", "dreamy", "romantic"], minWeirdness: 2, maxWeirdness: 4, weight: 9 },
  { id: "ko_machine_youth", slots: ["machine", "youth"], separator: "", scenes: ["hongdae", "punk"], moods: ["funny", "rough"], minWeirdness: 3, maxWeirdness: 5, weight: 9 },
  { id: "ko_machine_emotion", slots: ["machine", "emotion"], separator: "", scenes: ["hongdae", "punk", "emo"], moods: ["funny", "rough", "wistful"], minWeirdness: 3, maxWeirdness: 5, weight: 9 },
  { id: "ko_odd_youth", slots: ["odd", "youth"], separator: "", scenes: ["hongdae", "punk", "campus"], moods: ["funny", "rough"], minWeirdness: 4, maxWeirdness: 5, weight: 10 },
  { id: "ko_odd_suffix", slots: ["odd", "suffix"], separator: "", scenes: ["hongdae", "punk"], moods: ["funny", "rough"], minWeirdness: 4, maxWeirdness: 5, weight: 11 },
  { id: "ko_food_suffix", slots: ["food", "suffix"], separator: "", scenes: ["hongdae", "campus", "punk"], moods: ["funny", "fresh"], minWeirdness: 3, maxWeirdness: 5, weight: 8 },
  { id: "ko_light_sound", slots: ["light", "sound"], separator: "", scenes: ["emo", "citypop", "punk"], moods: ["dreamy", "rough"], minWeirdness: 2, maxWeirdness: 4, weight: 10 },
  { id: "ko_weather_emotion", slots: ["weather", "emotion"], separator: "", scenes: ["emo", "jrock"], moods: ["wistful", "dreamy", "romantic"], minWeirdness: 2, maxWeirdness: 4, weight: 9 },
  { id: "ko_nature_analog", slots: ["nature", "analog"], separator: "", scenes: ["citypop", "jrock", "emo"], moods: ["dreamy", "fresh", "romantic"], minWeirdness: 1, maxWeirdness: 4, weight: 9 },
  { id: "ko_emotion_movement", slots: ["emotion", "movement"], separator: "", scenes: ["punk", "emo", "jrock"], moods: ["rough", "wistful"], minWeirdness: 2, maxWeirdness: 5, weight: 8 },
  { id: "ko_machine_movement", slots: ["machine", "movement"], separator: "", scenes: ["punk", "hongdae"], moods: ["rough", "funny"], minWeirdness: 3, maxWeirdness: 5, weight: 8 },
  { id: "ko_three_word_poetic", slots: ["time", "color", "place"], separator: "", scenes: ["jrock", "emo"], moods: ["dreamy", "wistful"], minWeirdness: 1, maxWeirdness: 3, weight: 4 },
  { id: "ko_three_word_weird", slots: ["city", "odd", "suffix"], separator: "", scenes: ["hongdae", "punk"], moods: ["funny"], minWeirdness: 4, maxWeirdness: 5, weight: 3 },

  // --- 메탈 / 헤비록 (mixed 도 이 2슬롯 패턴에서 첫 슬롯 영어로 파생됨) ---
  { id: "ko_metalMaterial_doom", slots: ["metalMaterial", "doom"], separator: "", scenes: ["metal"], moods: ["rough", "wistful"], minWeirdness: 1, maxWeirdness: 4, weight: 16 },
  { id: "ko_doom_metalMaterial", slots: ["doom", "metalMaterial"], separator: "", scenes: ["metal"], moods: ["rough", "dreamy"], minWeirdness: 1, maxWeirdness: 4, weight: 15 },
  { id: "ko_doom_ritual", slots: ["doom", "ritual"], separator: "", scenes: ["metal"], moods: ["rough", "wistful", "dreamy"], minWeirdness: 1, maxWeirdness: 4, weight: 16 },
  { id: "ko_color_metalMaterial", slots: ["color", "metalMaterial"], separator: "", scenes: ["metal"], moods: ["rough", "dreamy"], minWeirdness: 1, maxWeirdness: 3, weight: 13 },
  { id: "ko_color_ritual", slots: ["color", "ritual"], separator: "", scenes: ["metal"], moods: ["dreamy", "wistful", "rough"], minWeirdness: 1, maxWeirdness: 3, weight: 12 },
  { id: "ko_beast_metalMaterial", slots: ["beast", "metalMaterial"], separator: "", scenes: ["metal"], moods: ["rough"], minWeirdness: 1, maxWeirdness: 4, weight: 13 },
  { id: "ko_beast_doom", slots: ["beast", "doom"], separator: "", scenes: ["metal"], moods: ["rough", "dreamy"], minWeirdness: 2, maxWeirdness: 5, weight: 12 },
  { id: "ko_metalMaterial_ritual", slots: ["metalMaterial", "ritual"], separator: "", scenes: ["metal"], moods: ["rough", "dreamy"], minWeirdness: 1, maxWeirdness: 4, weight: 14 },
  { id: "ko_fire_beast", slots: ["doom", "beast"], separator: "", scenes: ["metal"], moods: ["rough", "dreamy"], minWeirdness: 2, maxWeirdness: 4, weight: 12 },
  { id: "ko_metal_sound", slots: ["metalMaterial", "sound"], separator: "", scenes: ["metal"], moods: ["rough"], minWeirdness: 2, maxWeirdness: 4, weight: 10 },
  { id: "ko_doom_movement", slots: ["doom", "movement"], separator: "", scenes: ["metal"], moods: ["rough"], minWeirdness: 2, maxWeirdness: 5, weight: 10 },
  { id: "ko_machine_ritual_metal", slots: ["machine", "ritual"], separator: "", scenes: ["metal"], moods: ["funny", "rough"], minWeirdness: 3, maxWeirdness: 5, weight: 11 },
  { id: "ko_odd_doom_metal", slots: ["odd", "doom"], separator: "", scenes: ["metal"], moods: ["funny", "rough"], minWeirdness: 4, maxWeirdness: 5, weight: 9 },
  { id: "ko_food_ritual_metal", slots: ["food", "ritual"], separator: "", scenes: ["metal"], moods: ["funny"], minWeirdness: 4, maxWeirdness: 5, weight: 8 },
];

// ---------------------------------------------------------------------------
// 영어 패턴 (스펙 기본 + 펑크/개러지 결을 맞추기 위한 소량 보강)
// ---------------------------------------------------------------------------
export const englishPatterns: Pattern[] = [
  { id: "en_time_place", slots: ["time", "place"], separator: " ", scenes: ["jrock", "citypop", "emo"], moods: ["fresh", "wistful", "romantic"], minWeirdness: 1, maxWeirdness: 3, weight: 12 },
  { id: "en_color_analog", slots: ["color", "analog"], separator: " ", scenes: ["citypop", "emo", "jrock"], moods: ["dreamy", "romantic"], minWeirdness: 1, maxWeirdness: 3, weight: 12 },
  { id: "en_light_place", slots: ["light", "place"], separator: " ", scenes: ["citypop", "punk"], moods: ["dreamy", "rough", "romantic"], minWeirdness: 1, maxWeirdness: 4, weight: 10 },
  { id: "en_sound_suffix", slots: ["sound", "suffix"], separator: " ", scenes: ["emo", "punk", "hongdae"], moods: ["dreamy", "rough"], minWeirdness: 2, maxWeirdness: 4, weight: 10 },
  { id: "en_nature_analog", slots: ["nature", "analog"], separator: " ", scenes: ["citypop", "jrock", "emo"], moods: ["fresh", "dreamy", "romantic"], minWeirdness: 1, maxWeirdness: 3, weight: 9 },
  { id: "en_emotion_suffix", slots: ["emotion", "suffix"], separator: " ", scenes: ["emo", "jrock", "punk"], moods: ["wistful", "rough", "dreamy"], minWeirdness: 2, maxWeirdness: 4, weight: 9 },
  { id: "en_machine_emotion", slots: ["machine", "emotion"], separator: " ", scenes: ["punk", "hongdae", "emo"], moods: ["funny", "rough"], minWeirdness: 3, maxWeirdness: 5, weight: 8 },
  { id: "en_odd_suffix", slots: ["odd", "suffix"], separator: " ", scenes: ["punk", "hongdae"], moods: ["funny", "rough"], minWeirdness: 4, maxWeirdness: 5, weight: 8 },
  { id: "en_time_sound_suffix", slots: ["time", "sound", "suffix"], separator: " ", scenes: ["emo", "citypop"], moods: ["dreamy", "wistful"], minWeirdness: 2, maxWeirdness: 4, weight: 4 },
  // 펑크/개러지 결 보강 — DEAD BATTERY / NOISE GARAGE 같은 거칠고 시끄러운 조합용.
  { id: "en_color_machine", slots: ["color", "machine"], separator: " ", scenes: ["punk", "hongdae"], moods: ["rough", "funny"], minWeirdness: 3, maxWeirdness: 5, weight: 9 },
  { id: "en_sound_place", slots: ["sound", "place"], separator: " ", scenes: ["punk", "emo"], moods: ["rough", "dreamy"], minWeirdness: 2, maxWeirdness: 5, weight: 9 },
  { id: "en_color_youth", slots: ["color", "youth"], separator: " ", scenes: ["punk", "jrock"], moods: ["rough", "fresh"], minWeirdness: 2, maxWeirdness: 4, weight: 8 },

  // --- 메탈 / 헤비록 ---
  { id: "en_metalMaterial_doom", slots: ["metalMaterial", "doom"], separator: " ", scenes: ["metal"], moods: ["rough", "wistful"], minWeirdness: 1, maxWeirdness: 4, weight: 16 },
  { id: "en_doom_metalMaterial", slots: ["doom", "metalMaterial"], separator: " ", scenes: ["metal"], moods: ["rough", "dreamy"], minWeirdness: 1, maxWeirdness: 4, weight: 15 },
  { id: "en_color_ritual_metal", slots: ["color", "ritual"], separator: " ", scenes: ["metal"], moods: ["rough", "dreamy", "wistful"], minWeirdness: 1, maxWeirdness: 3, weight: 13 },
  { id: "en_doom_ritual", slots: ["doom", "ritual"], separator: " ", scenes: ["metal"], moods: ["rough", "dreamy"], minWeirdness: 1, maxWeirdness: 4, weight: 16 },
  { id: "en_beast_metalMaterial", slots: ["beast", "metalMaterial"], separator: " ", scenes: ["metal"], moods: ["rough"], minWeirdness: 1, maxWeirdness: 4, weight: 13 },
  { id: "en_beast_doom", slots: ["beast", "doom"], separator: " ", scenes: ["metal"], moods: ["rough", "dreamy"], minWeirdness: 2, maxWeirdness: 5, weight: 12 },
  { id: "en_metalMaterial_ritual", slots: ["metalMaterial", "ritual"], separator: " ", scenes: ["metal"], moods: ["rough", "dreamy"], minWeirdness: 1, maxWeirdness: 4, weight: 14 },
  { id: "en_machine_ritual_metal", slots: ["machine", "ritual"], separator: " ", scenes: ["metal"], moods: ["funny", "rough"], minWeirdness: 3, maxWeirdness: 5, weight: 10 },
  { id: "en_odd_doom_metal", slots: ["odd", "doom"], separator: " ", scenes: ["metal"], moods: ["funny", "rough"], minWeirdness: 4, maxWeirdness: 5, weight: 8 },
  { id: "en_food_ritual_metal", slots: ["food", "ritual"], separator: " ", scenes: ["metal"], moods: ["funny"], minWeirdness: 4, maxWeirdness: 5, weight: 7 },
];

// ---------------------------------------------------------------------------
// 씬별 카테고리 가중치 보정
// ---------------------------------------------------------------------------
export const sceneCategoryBoosts: Record<Scene, Partial<Record<WordCategory, number>>> = {
  jrock: { time: 1.4, season: 1.5, place: 1.3, analog: 1.2, youth: 1.3, movement: 1.2, odd: 0.4, machine: 0.6 },
  hongdae: { room: 1.5, analog: 1.2, odd: 1.3, food: 1.1, suffix: 1.3, machine: 1.1, time: 0.9 },
  punk: { machine: 1.4, movement: 1.5, sound: 1.5, odd: 1.2, light: 1.1, emotion: 0.8, nature: 0.5 },
  citypop: { light: 1.6, city: 1.4, analog: 1.4, nature: 1.2, time: 1.1, odd: 0.3, machine: 0.6 },
  emo: { emotion: 1.6, sound: 1.5, weather: 1.3, time: 1.3, light: 1.1, odd: 0.3, food: 0.2 },
  campus: { youth: 1.5, season: 1.4, place: 1.2, food: 1.0, analog: 1.0, odd: 0.7, machine: 0.5 },
  metal: {
    metalMaterial: 1.8, doom: 1.8, ritual: 1.5, beast: 1.4, sound: 1.2,
    machine: 1.1, movement: 1.1, color: 0.9, light: 0.8, emotion: 0.6,
    season: 0.2, food: 0.2, odd: 0.3, youth: 0.2, nature: 0.3,
  },
};

// ---------------------------------------------------------------------------
// 분위기별 카테고리 가중치 보정
// ---------------------------------------------------------------------------
export const moodCategoryBoosts: Record<Mood, Partial<Record<WordCategory, number>>> = {
  fresh: { season: 1.5, nature: 1.4, color: 1.3, youth: 1.2, emotion: 0.8, odd: 0.6 },
  dreamy: { light: 1.5, sound: 1.4, weather: 1.2, emotion: 1.3, nature: 1.2, food: 0.4 },
  wistful: { time: 1.4, weather: 1.3, emotion: 1.6, analog: 1.2, odd: 0.4, food: 0.4 },
  funny: { odd: 1.7, food: 1.5, machine: 1.3, room: 1.2, suffix: 1.4, emotion: 0.7 },
  rough: { machine: 1.5, movement: 1.5, sound: 1.5, light: 1.1, nature: 0.6, food: 0.7 },
  romantic: { time: 1.2, season: 1.3, city: 1.2, analog: 1.4, nature: 1.3, light: 1.2, odd: 0.4 },
};

// ---------------------------------------------------------------------------
// 선호 조합 / 차단 조합 / 제외 밴드명
// ---------------------------------------------------------------------------
export const preferredPairs: [string, string][] = [
  ["새벽", "옥상"], ["새벽", "비상구"], ["새벽", "정류장"], ["심야", "라디오"],
  ["심야", "자판기"], ["심야", "편의점"], ["여름", "정류장"], ["여름", "카세트"],
  ["여름밤", "라디오"], ["장마", "터널"], ["장마", "세탁소"], ["노을", "정류장"],
  ["노을", "자전거"], ["파랑", "소년"], ["파랑", "필름"], ["푸른", "옥상"],
  ["보라", "비상구"], ["네온", "호텔"], ["네온", "라디오"], ["네온", "교차로"],
  ["형광등", "클럽"], ["형광등", "소년"], ["달빛", "카세트"], ["별빛", "라디오"],
  ["도쿄", "세탁소"], ["도쿄", "카세트"], ["도쿄", "시네마"], ["홍대", "라디오"],
  ["홍대", "세탁소"], ["망원", "레코즈"], ["한강", "카세트"], ["옥상", "소년"],
  ["골목", "유령"], ["터널", "클럽"], ["편의점", "소년"], ["세탁소", "클럽"],
  ["오락실", "소년"], ["노이즈", "클럽"], ["노이즈", "카세트"], ["노이즈", "소년"],
  ["잔향", "라디오"], ["전파", "소년"], ["불면", "라디오"], ["미열", "카세트"],
  ["청춘", "질주"], ["청춘", "비상구"], ["고독", "라디오"], ["잔상", "시네마"],
  ["냉장고", "청춘"], ["세탁기", "소년"], ["자판기", "유령"], ["전자레인지", "클럽"],
  ["양말", "클럽"], ["두부", "소년단"], ["김밥", "레코즈"], ["라면", "클럽"],
  ["붕어빵", "합창단"], ["실내화", "소년단"], ["급식판", "클럽"],

  // --- 메탈 / 헤비록 좋은 조합 ---
  ["검은", "용광로"], ["검정", "제단"], ["붉은", "사슬"], ["핏빛", "왕관"],
  ["철", "폭풍"], ["강철", "심장"], ["철갑", "폭풍"], ["철갑", "군단"],
  ["쇠사슬", "제단"], ["칼날", "왕관"], ["도끼", "제단"], ["망치", "군단"],
  ["용광로", "심연"], ["용광로", "폭풍"], ["엔진", "파멸"], ["기관차", "화염"],
  ["전차", "폭풍"], ["심연", "제단"], ["심연", "왕관"], ["심연", "군단"],
  ["파멸", "기관차"], ["파멸", "제단"], ["지옥", "전차"], ["지옥", "사냥개"],
  ["화염", "용"], ["화염", "왕관"], ["폭풍", "기사단"], ["천둥", "망치"],
  ["폐허", "왕관"], ["폐허", "제단"], ["어둠", "성전"], ["암흑", "교단"],
  ["검은불", "성가대"], ["악몽", "군단"], ["용", "철갑"], ["검은용", "제단"],
  ["늑대", "사슬"], ["까마귀", "왕관"], ["해골", "엔진"], ["악마", "기관차"],
  ["사신", "군단"], ["야수", "폭풍"], ["멀티탭", "교단"], ["냉장고", "파멸"],
  ["전기밥솥", "제단"], ["급식판", "폭풍"], ["고무장갑", "학살"],
  ["IRON", "TEMPEST"], ["IRON", "ALTAR"], ["STEEL", "THUNDER"],
  ["STEEL", "LEGION"], ["BLACK", "ALTAR"], ["BLACK", "FURNACE"],
  ["CRIMSON", "CHAIN"], ["BLOOD", "CROWN"], ["DOOM", "ENGINE"], ["DOOM", "CULT"],
  ["HELL", "FURNACE"], ["HELL", "HOUND"], ["ABYSS", "ALTAR"], ["ABYSS", "THRONE"],
  ["THUNDER", "HAMMER"], ["FIRE", "DRAGON"], ["RUIN", "CROWN"], ["RAVEN", "THRONE"],
  ["SKULL", "ENGINE"], ["DEMON", "LEGION"], ["MICROWAVE", "CULT"], ["SOCKS", "DOOM"],
];

export const blockedPairs: [string, string][] = [
  ["밤", "한밤"], ["새벽", "아침"], ["소년", "소녀"], ["파도", "물결"],
  ["라디오", "라디오"], ["카세트", "테이프"], ["빛", "불빛"], ["우울", "눈물"],
  ["비", "빗방울"], ["여름", "겨울"], ["첫차", "막차"], ["청춘", "청춘"],
  ["호텔", "모텔"], ["김밥", "삼각김밥"], ["냉장고", "전자레인지"],
  ["세탁기", "세탁소"], ["편의점", "삼각김밥"], ["정류장", "승강장"],
  ["출구", "비상구"], ["오후", "자정"],

  // --- 메탈 / 헤비록 의미 중복·어색 조합 ---
  ["철", "강철"], ["철", "철갑"], ["강철", "철갑"], ["사슬", "쇠사슬"],
  ["검", "대검"], ["칼날", "검날"], ["화염", "불길"], ["어둠", "암흑"],
  ["파멸", "멸망"], ["종말", "멸망"], ["죽음", "사신"], ["무덤", "묘지"],
  ["성전", "기사단"], ["왕관", "왕좌"], ["용", "검은용"], ["괴물", "괴수"],
  ["악마", "마왕"],
  ["IRON", "STEEL"], ["CHAIN", "BARBED WIRE"], ["BLADE", "SWORD"],
  ["FIRE", "FLAME"], ["DOOM", "DEATH"], ["HELL", "INFERNO"],
  ["DARKNESS", "BLACK FIRE"], ["GRAVE", "GRAVEYARD"], ["CROWN", "THRONE"],
  ["DRAGON", "BLACK DRAGON"], ["DEMON", "HELLHOUND"],
];

export const blockedExactNames = new Set([
  "혁오", "새소년", "실리카겔", "잔나비", "자우림", "국카스텐", "언니네이발관",
  "검정치마", "데이브레이크", "브로콜리너마저", "소란", "넬", "체리필터",
  "쏜애플", "ADOY", "DAY6", "LUCY", "NELL", "HYUKOH", "SE SO NEON",
  "SILICA GEL", "RADWIMPS", "ONE OK ROCK", "YOASOBI", "YORUSHIKA",
  "ASIAN KUNG-FU GENERATION", "TOKYO JIHEN", "THE 1975", "RADIOHEAD",
  "OASIS", "BLUR", "GREEN DAY", "PARAMORE", "MUSE", "COLDPLAY",
  // 메탈 / 헤비록 (대문자 통일 비교 — isBlockedExactName 이 toUpperCase 도 검사)
  "METALLICA", "SLIPKNOT", "MEGADETH", "IRON MAIDEN", "BLACK SABBATH",
  "JUDAS PRIEST", "SLAYER", "PANTERA", "ANTHRAX", "KORN", "SYSTEM OF A DOWN",
  "LINKIN PARK", "LIMP BIZKIT", "RAMMSTEIN", "AVENGED SEVENFOLD",
  "BRING ME THE HORIZON", "BABYMETAL", "X JAPAN", "LOUDNESS", "DIR EN GREY",
  "MAXIMUM THE HORMONE", "부활", "시나위", "백두산", "크래쉬", "블랙홀",
]);

// ---------------------------------------------------------------------------
// 결과 카드용 라벨
// ---------------------------------------------------------------------------
export const sceneLabels: Record<Scene, string> = {
  jrock: "J-ROCK",
  hongdae: "홍대 인디",
  punk: "펑크",
  citypop: "시티팝",
  emo: "이모 / 슈게이즈",
  campus: "청춘록",
  metal: "메탈 / 헤비록",
};

export const moodLabels: Record<Mood, string> = {
  fresh: "청량함",
  dreamy: "몽환적",
  wistful: "쓸쓸함",
  funny: "묘하게 웃김",
  rough: "거친 느낌",
  romantic: "낭만적",
};
