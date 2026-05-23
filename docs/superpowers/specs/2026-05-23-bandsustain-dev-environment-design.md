# bandsustain DEV 환경 구축 설계

- 작성일: 2026-05-23
- 대상: bandsustain.com 에 운영(PROD) / 개발(DEV) 분리 환경 도입
- 패턴: routines / PT / boot 의 dev-prod 분리 방식을 그대로 차용

## 1. 배경 / 목적

bandsustain 은 현재 단일 환경(운영만 존재)이라, 코드 수정·PM2 재시작·push 가 모두 곧바로 운영 반영이 된다.
이로 인해 매 액션이 운영 배포로 간주되어 안전한 사전 검증 단계가 없다. 다른 소리튠 사이트들과 동일하게
DEV 환경을 추가하여 `dev` 브랜치에서 작업·검증한 뒤 명시적 승인 시에만 `main` 으로 머지/배포하는 플로우를 도입한다.

## 2. 현재 PROD 현황 (확인된 사실)

| 항목 | 값 |
|------|-----|
| 앱 루트 | `/var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain` |
| 심볼릭 링크 | `/root/bandsustain` |
| 스택 | Next.js 16.2.4 + React 19 + pnpm + PM2 (node v20.20.1) |
| PM2 프로세스 | `bandsustain` (fork), 포트 **3100**, 소유자 `ec2-user` |
| DB | `BANDSUSTAIN` (DB_HOST=localhost, DB_USER=`BANDSUSTAIN`) |
| 자격증명 | `/var/www/html/_______site_BANDSUSTAIN/.db_credentials` (ec2-user:ec2-user 600) |
| GitHub | `pjuhe99/bandsustain`, SSH alias `github-bandsustain` (IdentityFile `~/.ssh/id_ed25519_bandsustain`) |
| 브랜치 | `main` (현재), `work` (=main, 0 ahead) |
| 도메인 | **bandsustain.com (자체 도메인)** — DNS는 가비아(Gabia, `ns.gabia.co.kr`) |
| 인증서 | Let's Encrypt `/etc/letsencrypt/live/bandsustain.com/` |
| Apache vhost | `/etc/httpd/conf.d/bandsustain.com.conf` (80→443 리다이렉트 + 443 프록시 → 127.0.0.1:3100) |
| 서버 공인 IP | `3.37.213.224` |
| cron | `deploy-sweep.sh` 매분 실행 (self-deploy 메커니즘, deploy_history 테이블 연동) — **PROD 전용** |

### 코드상 중요 사실
- `src/lib/creds.ts` 의 `DEFAULT_PATH` 가 PROD 절대경로(`/var/www/html/_______site_BANDSUSTAIN/.db_credentials`)로
  **하드코딩**되어 있으나, `process.env.DB_CREDENTIALS_PATH` 환경변수로 오버라이드 가능.
- `yeongmin_settings` 테이블에 OpenAI API 키가 `ENCRYPTION_KEY`(64-hex)로 암호화되어 저장됨
  (`src/lib/yeongminCrypto.ts`, `src/app/api/admin/yeongmin-bot/api-key/route.ts`).
  → DEV 가 PROD DB 를 복사하면 **ENCRYPTION_KEY 를 PROD 와 동일하게 유지**해야 키 복호화 가능.

## 3. DEV 환경 목표 사양

| 항목 | DEV 값 |
|------|--------|
| 앱 루트 | `/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain` |
| 심볼릭 링크 | `/root/bandsustain-dev` |
| 소유권 | 전체 `ec2-user:ec2-user` (root-owned 파일 함정 방지) |
| 브랜치 | `dev` (main 에서 분기, origin push). DEV 디렉토리는 `dev` 체크아웃 |
| DB | `BANDSUSTAIN_DEV` (PROD 전체 복사, PII 포함) |
| DB 사용자 | 기존 `BANDSUSTAIN` 유저에 `BANDSUSTAIN_DEV` 권한 부여 |
| 자격증명 | `/var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials` (ec2-user:ec2-user 600) |
| PM2 프로세스 | `bandsustain-dev`, 포트 **3101** |
| 도메인 | **dev.bandsustain.com** (가비아에 A 레코드 → 3.37.213.224 추가) |
| 인증서 | Let's Encrypt `dev.bandsustain.com` (http-01) |
| Apache vhost | `/etc/httpd/conf.d/dev.bandsustain.com.conf` (80→443 + 443 프록시 → 127.0.0.1:3101) |
| cron | 없음 (deploy-sweep 미설정, manual build+restart) |

### DEV `.db_credentials` 내용
- `DB_HOST=localhost`
- `DB_NAME=BANDSUSTAIN_DEV`
- `DB_USER=BANDSUSTAIN` (또는 dev 전용 유저)
- `DB_PASS=` (해당 유저 비밀번호)
- `ENCRYPTION_KEY` = **PROD 와 동일** (yeongmin OpenAI 키 복호화용)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` = PROD 복사 (로그인 유지)
- `ADMIN_SESSION_SECRET` = **DEV 신규 생성**
- `ANALYTICS_SECRET` = **DEV 신규 생성**

### DEV `.env.local`
- `NEXT_PUBLIC_KAKAO_APP_KEY` = PROD 복사
  (카카오 JS SDK 도메인 등록은 dev.bandsustain.com 추가 등록이 필요할 수 있음 — 별도 처리)

### DEV `ecosystem.config.js`
PROD 와 동일하되:
- `name: "bandsustain-dev"`
- `cwd:` DEV 앱 루트
- `env: { NODE_ENV: "production", PORT: 3101, DB_CREDENTIALS_PATH: "/var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials" }`

> ⚠️ `DB_CREDENTIALS_PATH` 미설정 시 `creds.ts` 하드코딩 경로 때문에 DEV 앱/스크립트가 **PROD DB** 를 본다.
> tsx 스크립트(`pins:verify`, `playground:*` 등)를 DEV 에서 실행할 때도 이 변수를 export 해야 한다.

## 4. SELinux

- DEV `logs` 디렉토리(`_______site_BANDSUSTAIN_DEV/logs`)에 `httpd_log_t` 컨텍스트 설정
  (PROD 와 동일, 미설정 시 Apache 가 로그 못 써서 httpd 다운 위험).
- 업로드/에셋(`uploaded-assets`)은 node(ec2-user)가 직접 서빙하므로 httpd 컨텍스트 불필요.

## 5. DNS (외부 의존 — 사용자 조치 필요)

가비아 DNS 콘솔에서 A 레코드 추가:

| 타입 | 호스트 | 값 | TTL |
|------|--------|-----|-----|
| A | `dev` | `3.37.213.224` | 기본값 |

전파 확인(`getent hosts dev.bandsustain.com`) 후 인증서 발급 진행.

## 6. 배포 플로우 (구축 후 메모리에 신규 기록)

```
bandsustain-dev 에서 commit → push origin dev → pnpm build → pm2 restart bandsustain-dev (DEV 검증)
→ ⛔ 여기서 반드시 멈춤. 사용자에게 dev 확인 요청 (https://dev.bandsustain.com)
→ 사용자가 "운영 반영해줘" 등 명시적으로 요청한 경우에만 아래 진행
→ bandsustain-dev 에서 checkout main → merge dev → push origin main → checkout dev
→ bandsustain-prod 에서 git pull origin main → pnpm install(필요시) → pnpm build → pm2 restart bandsustain
→ PROD DB 수정 필요 시 bandsustain-prod .db_credentials 사용하여 적용
```

작업 규칙(다른 사이트와 동일):
1. 코드 수정은 항상 `bandsustain-dev` (dev 브랜치)에서만
2. DB 수정은 항상 DEV `.db_credentials` 로 DEV DB 먼저
3. dev push 후 반드시 멈추고 사용자 확인 → 명시 요청 시에만 운영 반영
4. `bandsustain-prod`(main)에 직접 코드 수정/커밋 절대 금지

## 7. 구축 순서 (구현 단계 개요)

1. `dev` 브랜치 생성(main 분기) + 이 spec 커밋 + origin push
2. DEV 디렉토리/심볼릭 링크 생성, ec2-user 로 `github-bandsustain` 클론, `dev` 체크아웃
3. `BANDSUSTAIN_DEV` DB 생성 + PROD 전체 덤프 복사 + 유저 권한 부여
4. DEV `.db_credentials` / `.env.local` / `ecosystem.config.js` 작성 (시크릿 신규 생성)
5. `pnpm install` + `pnpm build` (ec2-user)
6. SELinux `httpd_log_t` 설정
7. PM2 `bandsustain-dev` 등록 (포트 3101) + `pm2 save`
8. (DNS 추가 확인 후) Apache vhost 작성 + Let's Encrypt 인증서 발급 + httpd reload
9. 스모크 테스트 (https://dev.bandsustain.com 200, DEV DB 접속 확인)
10. 메모리에 bandsustain dev-prod 규칙/플로우 기록

## 8. 리스크 / 주의

- **creds.ts 하드코딩 경로**: DEV 에서 `DB_CREDENTIALS_PATH` 누락 시 PROD DB 오염 위험.
  ecosystem 및 스크립트 실행 시 항상 설정. (후속: cwd 기반 상대경로 해석으로 하드닝 검토 — 별도 작업)
- **deploy-sweep cron**: PROD 전용. DEV 에는 설정하지 않음. DEV DB 의 `deploy_history` 복사본이
  PROD sweep 에 영향 주지 않도록 sweep 은 PROD 디렉토리만 감시함을 확인.
- **PII**: DEV DB 는 PROD 실데이터(members 등) 포함. 동기화는 수동, dev 도메인은 운영과 동일 보안 취급.
- **카카오 도메인**: dev.bandsustain.com 이 카카오 JS SDK 허용 도메인에 없으면 카카오 기능 일부 동작 안 할 수 있음.
- **포트 충돌**: 3101 미사용 확인 필요.
