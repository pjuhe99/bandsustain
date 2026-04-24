# Quote 탭 디자인 — WIP (brainstorming 중단)

> **상태:** 브레인스토밍 중단됨 (세션 종료로 인한 일시 중단). 다음 세션에서 아래 "다음 단계"부터 재개.
> **작성일:** 2026-04-24
> **브레인스토밍 스킬:** `superpowers:brainstorming`

---

## 컨텍스트

사용자 원문:
> bandsustain.com 에서 'quote' 탭의 기본 UI를 짜려고 해. 여기의 부제(다른 탭과 같은 스타일)는 'These are words that don't really help in life / 삶에 별로 도움은 되지 않을 명언들'야. 이 탭의 목적은 사실 진짜 명언은 아닌데, 웃긴 말을 대단한 명언처럼 올려놓는 공간이거든. 여기 UI를 어떻게 구성하면 좋을까? 여기도 좀 특이하고, 전반적인 사이트 톤과 잘 어울렸으면 좋겠어

### 확정된 제약
- 부제 (다른 탭 패턴 동일): `These are words that don't really help in life` / `삶에 별로 도움은 되지 않을 명언들`
- 사이트 디자인 DNA (`bandsustain/CLAUDE.md` 기준): newspaper/magazine × 음악 밴드, 화이트 베이스 + 블랙 타이포, 오렌지 액센트 극소량, 직각, 그림자/그라디언트 없음, editorial typography-first
- 이미 songs 탭 안에 가짜 명언 스타일의 section divider (`"좋은 곡을 듣는다는 것은, 좋은 삶을 살고 있다는 뜻입니다. — 서스테인 —"`) 가 있음 → quote 탭은 그 감성의 확장

### 현재 quote 페이지 상태
- `src/app/quote/page.tsx` 에 `Coming soon.` 만 있음

---

## 결정 사항 (진행 중)

### Q1. 콘텐츠 소스
- 선택: **B. DB에 저장, 관리자 페이지로 CRUD**

### bandsustain 현재 인프라 (확인됨)
- DB/API/admin/auth **전부 없음** — songs/members 모두 하드코딩
- mysql 드라이버 미설치
- .db_credentials 파일은 `/root/bandsustain/.db_credentials` 에 존재 (빈 파일일 수 있으니 재확인 필요)
- Next.js 16 + Tailwind v4 + PM2 포트 3100

### 결과적으로 B = 4개 서브시스템 필요
1. DB 스키마 + mysql2 드라이버 + credentials 로더
2. API routes (`/api/quotes` CRUD)
3. 어드민 페이지 + 인증
4. public quote 탭 UI ← 원래 물어본 부분

---

## 다음 단계 (세션 재개 시 여기서부터)

### 🔵 Q2 (미답변) — 스코프 분할

원래 질문이 "UI 어떻게 구성하면 좋을까"였는데 B 선택으로 4개 서브시스템이 엮여서 스코프 점검 중이었음. 사용자에게 아래 질문한 상태:

- **A.** 전부 하나의 spec으로 묶기 (큰 계획, 단계적 구현)
- **B.** public UI + DB 스키마만 먼저 설계 (초기엔 DB 수동 INSERT) → 어드민은 별도 spec 나중에
- **C.** 원래대로 public UI 부터 하드코딩으로 짓고, DB + 어드민은 완전 별도 프로젝트로 나중에

Claude 추천: **B** — quote 는 누적되어야 의미 있으니 스키마는 같이 잡되, 어드민까지 한 번에 짓는 건 ROI 낮음. 콘텐츠·톤 검증 후 관리 UI 만드는 순서.

### 이후 예정 질문 (Q2 결정에 따라 조정)
- Q3. quote 데이터 모델 — 필드 뭐뭐? (text, attribution, 날짜, 언어, 태그?)
- Q4. bilingual 여부 — 영어/한글 둘 다 올릴 건지 / 한쪽만
- Q5. attribution 스타일 — 실제 인물처럼 가짜 이름? 멤버 이름? 무기명?
- Q6. 개수 / 페이지네이션 / 정렬 (최신순, 랜덤, 큐레이션?)
- Q7. 레이아웃 — 3컬럼 카드? 단일 컬럼 매거진? 큰 타이포 한 개씩? ← **비주얼 컨패니언 사용**
- Q8. 인터랙션 — 링크로 특정 quote 공유? 모달? 단순 스크롤?

### 체크리스트 진행 현황
- [x] 1. 프로젝트 컨텍스트 탐색
- [x] 2. Visual Companion 제안 (사용자 승인)
- [ ] 3. clarifying questions 진행 ← **여기 Q2 대기 중**
- [ ] 4. 2~3 접근법 제안
- [ ] 5. 설계 섹션 제시 및 승인
- [ ] 6. spec 문서 작성 및 커밋
- [ ] 7. spec self-review
- [ ] 8. 사용자 spec 리뷰 요청
- [ ] 9. writing-plans skill 호출

---

## 비주얼 컨패니언 세션
- 서버는 세션 종료 시 stop 예정.
- 콘텐츠 디렉토리: `.superpowers/brainstorm/1125026-1777023158/` (재개 시 새 세션 시작해도 무방)
- 기존 mockup 하나 있음: `content/welcome.html` (참고 — Members/Quote 헤더 비교)

---

## 재개 절차

새 세션에서:
1. 이 파일 읽기
2. `bandsustain/CLAUDE.md` 숙지
3. Q2 답변 받으면 WIP 표시 제거하고 정식 spec 으로 진행
4. 최종 완성되면 `2026-04-24-quote-tab-design.md` 로 rename (WIP 접미사 제거)
