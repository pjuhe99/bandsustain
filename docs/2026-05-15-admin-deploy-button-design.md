# Admin Deploy Button — Design

> bandsustain 어드민에 GitHub `origin/main` 코드를 서버에 반영하는 [배포] 버튼을 추가한다. 1차 테스트 목적이며, 향후 junior/pt/boot/routines 멀티사이트 대시보드로 확장할 때의 패턴 검증 역할도 겸한다.

- 작성일: 2026-05-15
- 대상 사이트: bandsustain.com (단일 main 브랜치)
- 영향 범위: `/admin/deploy` 신규 탭 + `/api/admin/deploy/*` 신규 API + `scripts/deploy.sh` + `deploy_history` 신규 테이블

---

## 1. 목적과 비목적

### 목적
- 어드민이 SSH 없이 웹 UI에서 `origin/main`의 최신 코드를 서버에 반영할 수 있다.
- 배포 전 remote diff 미리보기를 제공한다.
- 배포 실패 또는 운영 이상 시 직전 버전으로 1-클릭 롤백할 수 있다.
- 최근 10건 배포 이력을 조회할 수 있다.

### 비목적 (1차 범위 밖)
- DEV/PROD 분리 (bandsustain은 단일 main 브랜치 운영)
- 멀티사이트 통합 대시보드 (별도 후속 작업)
- 자동 배포(웹훅/CI 트리거) — 항상 수동 트리거
- 자동 롤백 (smoke 실패해도 사람이 판단)
- 다중 환경 변수/시크릿 관리 UI

---

## 2. 핵심 결정 사항

| 항목 | 결정 |
|---|---|
| 실행 주체 | Next.js 프로세스가 `child_process.spawn`으로 직접 실행. sudo·sudoers 변경 없음. |
| Self-restart 처리 | `setsid + detached + unref`로 부모(`pm2 restart`)와 독립된 자식 셸 스크립트 |
| UX 패턴 | jobId 발급 후 즉시 202 응답 → UI는 2초마다 로그 polling |
| UI 위치 | `/admin/deploy` 신규 탭 (AdminNav에 'Deploy' 항목 추가) |
| 성공 판단 | git pull + pnpm build + pm2 restart 모두 exit 0 **AND** restart 후 health URL 200 OK |
| 안전장치 | 동시성 lock(flock), remote diff 미리보기, 이전 commit 롤백, 최근 10건 이력 |
| 저장 위치 | 로그: `/var/log/bandsustain-deploy/<jobId>.log` 파일 / 이력 메타: MariaDB `deploy_history` |

---

## 3. 아키텍처

```
┌─────────────────────┐
│ /admin/deploy 페이지 │  (Next.js Server + Client)
│  - 현재 HEAD/마지막 배포
│  - [DIFF 새로고침]
│  - [운영에 반영] / [롤백]
│  - 진행 로그 (polling)
│  - 이력 테이블
└──────┬──────────────┘
       │  POST /api/admin/deploy
       │  POST /api/admin/deploy/diff
       │  POST /api/admin/deploy/rollback
       │  GET  /api/admin/deploy/[jobId]/log
       │  GET  /api/admin/deploy/history
       ▼
┌─────────────────────────────────────────────────────────────┐
│ Next.js API handlers (server-only, readSession 게이트)       │
│  - DB SELECT: status='running' 행 존재 시 409 + 그 jobId 반환 │
│  - jobId = yyyymmdd-HHMMSS-<rand6>                           │
│  - DB INSERT deploy_history (status='running')               │
│  - spawn(detached: true, setsid) scripts/deploy.sh <jobId>   │
│  - 즉시 202 응답                                             │
│  ※ 부모는 flock을 잡지 않는다. 자식 셸이 단일 lock holder.    │
└──────┬──────────────────────────────────────────────────────┘
       │ (자식 프로세스, 부모 restart와 무관하게 살아남음)
       ▼
┌─────────────────────────────────────────────────────────────┐
│ scripts/deploy.sh <jobId> [--rollback <hash>]                │
│   - flock -n /var/log/bandsustain-deploy/lock 획득 (단일 holder)│
│   - 모든 출력 → /var/log/bandsustain-deploy/<jobId>.log       │
│   - ## STEP/## STEP_OK/## RESULT 마커                         │
│   - PRE_HEAD/POST_HEAD 기록                                   │
│   - pm2 restart bandsustain                                   │
│   - sleep 5 → curl http://127.0.0.1:3100/ 200 체크 (3회 재시도)│
│   - 결과를 DB로 UPDATE (mariadb CLI)                          │
│   - flock 자동 해제(셸 종료 시)                                │
└─────────────────────────────────────────────────────────────┘
```

### 불변식 (INV)
- **INV-1 (단일 실행):** 한 시점에 `lock` 보유자(자식 셸)는 최대 1명. 부모(API 핸들러)는 DB의 status='running' 행으로 사전 차단(409); 두 요청이 DB 체크를 동시에 통과하더라도 자식 측 `flock -n` 가 두 번째를 exit 3으로 즉시 실패시킴 (해당 jobId는 sweep에서 'interrupted' 정정).
- **INV-2 (로그 일관성):** 어떤 종료 경로든 로그 마지막에 `## RESULT SUCCESS | FAIL | INTERRUPTED` 한 줄이 반드시 존재.
- **INV-3 (이력 정합성):** `deploy_history.status ∈ {running, success, fail, interrupted}`. status='running'인데 lock 미점유 + started_at이 15분 이상 지난 row는 sweep으로 `interrupted` 정정.
- **INV-4 (권한 격리):** 모든 셸 경로는 ec2-user 권한으로만. sudoers·setuid 변경 없음.

---

## 4. 컴포넌트 / 파일 구성

### 신규 파일

```
src/app/admin/(authed)/deploy/
  page.tsx                         # 서버 컴포넌트: 현재 HEAD/마지막 배포/이력 SSR fetch
  DeployPanel.tsx                  # 클라이언트: diff/배포/롤백 버튼 + polling 로그

src/app/api/admin/deploy/
  route.ts                         # POST: 배포 시작
  diff/route.ts                    # POST: git fetch + diff 미리보기
  rollback/route.ts                # POST: 직전 PRE_HEAD로 복원
  history/route.ts                 # GET: 최근 10건
  [jobId]/log/route.ts             # GET: tail 파일 + DB status

src/lib/
  deploy.ts                        # 순수 함수: jobId 생성, lock 헬퍼, 로그 줄 파싱
  deploy-db.ts                     # mysql2 풀로 deploy_history CRUD

scripts/
  deploy.sh                        # bash, ec2-user. 메인 배포 스크립트
  deploy-sweep.sh                  # stale 'running' row 정정 (cron 1분, 선택)

db/schema/
  011_deploy_history.sql           # 신규 테이블 (다음 schema 번호)
```

### 수정 파일

```
src/components/admin/AdminNav.tsx  # items 배열에 { href: "/admin/deploy", label: "Deploy" }
```

### 책임 경계
- `deploy.ts` — 순수 함수만(셸 호출 X), jobId 발급, lock fd 관리, 로그 줄 파싱
- `deploy-db.ts` — DB I/O만
- `route.ts`×5 — auth 게이트 + 입력 검증 + lib 호출 + 응답 (얇은 컨트롤러)
- `deploy.sh` — 셸 실행. Next.js 없이도 SSH로 직접 호출 가능해야 함 (개발자 도구 가치)

---

## 5. `scripts/deploy.sh` 외부 인터페이스

### 입력
- `$1 = jobId` (필수, 정규식 `^[0-9]{8}-[0-9]{6}-[a-f0-9]{6}$`)
- `$2 = --rollback` (선택)
- `$3 = <commit-hash>` (`--rollback` 사용 시 필수)

### 환경변수 (기본값)
- `DEPLOY_LOG_DIR=/var/log/bandsustain-deploy`
- `APP_DIR=/var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain`
- `PM2_NAME=bandsustain`
- `HEALTH_URL=http://127.0.0.1:3100/`
- `DB_HOST/DB_USER/DB_PASS/DB_NAME` (`.db_credentials`에서 읽음)

### 출력
- stdout/stderr → `${DEPLOY_LOG_DIR}/${jobId}.log` 로 redirect (`exec >> ... 2>&1`)
- 마커 라인: `## STEP <name>` / `## STEP_OK <name> <duration>s` / `## STEP_FAIL <name> exit=<n>` / `## PRE_HEAD <hash>` / `## POST_HEAD <hash>` / `## RESULT SUCCESS|FAIL|INTERRUPTED total=<sec>s`

### 종료코드
- `0` 성공
- `1` 배포 단계 실패 (git/pnpm 등)
- `2` smoke 실패
- `3` lock 획득 실패

### 단계 순서
1. flock 재획득 (non-block; 실패 시 exit 3)
2. `git fetch origin main`
3. `## PRE_HEAD $(git rev-parse HEAD)`
4. `git pull --ff-only origin main` (또는 `--rollback` 시 `git reset --hard <hash>`)
5. `pnpm install --frozen-lockfile` (lockfile 변경된 경우만 — `git diff PRE..HEAD pnpm-lock.yaml` 비교)
6. `pnpm build`
7. `## POST_HEAD $(git rev-parse HEAD)`
8. `pm2 restart bandsustain`
9. `sleep 5`; `curl -sS -o /dev/null -w '%{http_code}'` 3회 재시도(5s/8s/13s 간격)
10. 200 → `## RESULT SUCCESS`, 아니면 `## RESULT FAIL step=smoke`
11. DB UPDATE (mariadb CLI: `mysql --defaults-file=... -e "UPDATE deploy_history SET ..."`)
12. flock 자동 해제 (셸 종료)

---

## 6. 데이터 모델

### 새 테이블: `deploy_history`
DB: `SORITUNECOM_BANDSUSTAIN`

```sql
CREATE TABLE deploy_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_id VARCHAR(40) NOT NULL UNIQUE,
  actor VARCHAR(64) NOT NULL,
  kind ENUM('deploy','rollback') NOT NULL,
  pre_head CHAR(40) NULL,
  post_head CHAR(40) NULL,
  target_ref VARCHAR(100) NULL,
  status ENUM('running','success','fail','interrupted') NOT NULL,
  fail_step VARCHAR(40) NULL,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  duration_sec INT NULL,
  log_path VARCHAR(255) NOT NULL,
  INDEX idx_started_at (started_at DESC),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 로그 파일 포맷 (예시)

```
## JOB 20260515-103245-a7b3f2 START kind=deploy actor=admin
## STEP git_fetch
... (git output)
## STEP_OK git_fetch 0.4s
## STEP git_pull
... 
## STEP_OK git_pull 1.2s
## PRE_HEAD abc1234567890abcdef1234567890abcdef1234
## STEP pnpm_install (skipped — lockfile unchanged)
## STEP pnpm_build
... (pnpm build output)
## STEP_OK pnpm_build 32.1s
## POST_HEAD def5678901234abcdef5678901234abcdef5678
## STEP pm2_restart
[PM2] restart bandsustain ...
## STEP_OK pm2_restart 1.5s
## STEP smoke
HTTP 200 (412ms)
## STEP_OK smoke 5.4s
## RESULT SUCCESS total=40.5s
```

UI는 마지막 `## STEP X` ~ `## STEP_OK X` 사이를 "현재 단계 진행 중"으로 표시한다.

---

## 7. 데이터 흐름 / 시퀀스

### A. 배포 시작 (Happy path)
1. UI: [운영에 반영] 클릭 → `POST /api/admin/deploy`
2. API: `readSession()` OK → flock try non-block → jobId 발급 → DB INSERT (status=running) → `spawn('bash', [scriptPath, jobId], { detached: true, stdio: 'ignore' }).unref()` → 202 `{ jobId }`
3. UI: 즉시 polling 시작 (`GET /api/admin/deploy/[jobId]/log`, 2초 간격)
4. 자식 스크립트: lock 재획득 → git pull → build → pm2 restart (Next.js 죽었다가 부활) → smoke → DB UPDATE
5. UI polling은 restart 중에는 짧게 backoff 후 재개. `## RESULT SUCCESS` 라인 만나면 polling 중단.

### B. 동시 클릭 (INV-1)
- 요청2: flock try 실패 → DB에서 status='running' row 조회 → `409 { jobId: <기존>, message: "이미 진행 중" }`
- UI: 자동으로 해당 jobId 로그로 점프해서 polling 인계.

### C. 단계 실패 (예: pnpm build)
- deploy.sh: pnpm build → exit 1 → 로그에 `## RESULT FAIL step=pnpm_build`
- DB UPDATE status=fail, fail_step=pnpm_build
- pm2 restart 미실행 → 운영 영향 없음
- UI: 실패 배너 + 로그 노출. [롤백]은 동일 HEAD이므로 비활성.

### D. Smoke 실패
- build/restart 성공했으나 health URL 200 안 뜸 → 3회 재시도 모두 실패 → `## RESULT FAIL step=smoke last_http=<code>`
- 자동 롤백은 하지 않음(정책).
- UI: 빨간 배너 "운영 응답 실패. [이전 버전으로 롤백] 권장" 강조.

### E. 롤백
- `POST /api/admin/deploy/rollback` body: `{ target_hash }`
- 서버 측 검증: `target_hash` 가 과거 `deploy_history.status='success'` row 중 어느 하나의 `pre_head` 또는 `post_head` 와 일치해야만 허용 (임의 hash 금지). 추가로 `git cat-file -e <hash>` 로 존재 확인.
- UI 기본 추천: 가장 최근 success row의 `pre_head` (= 직전 안정 버전). 드롭다운으로 더 과거 success 의 post_head 선택 가능.
- 같은 spawn 경로, `deploy.sh <jobId> --rollback <hash>` 호출.

### F. Interrupted sweep
- `deploy-sweep.sh` (cron 1분 또는 API 호출 시 lazy):
  ```sql
  SELECT id, job_id FROM deploy_history
  WHERE status='running' AND started_at < NOW() - INTERVAL 15 MINUTE
  ```
- 각 row에 대해 `flock -n <logfile>` 시도. 성공(즉 잡혀있지 않음) → `UPDATE status='interrupted'`. 잡혀있으면 skip.

---

## 8. UI 와이어 (텍스트)

```
┌─ /admin/deploy ────────────────────────────────────────────┐
│  CURRENT HEAD                                                │
│  abc1234 — "fix: live tab order"                            │
│  배포 시각: 2026-05-14 21:26 (어제), actor: admin            │
│                                                              │
│  ┌─ REMOTE STATUS ─────────────────────────────────────┐    │
│  │ [DIFF 새로고침]   (마지막 fetch: 30초 전)           │    │
│  │ origin/main 이 2 commits 앞:                         │    │
│  │   • def5678 update news layout                       │    │
│  │   • 89a1b2c add featured song                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  [ ▶ 운영에 반영 (origin/main → 서버) ]   ← Primary 블랙 솔리드 │
│  [ ↩ 이전 버전으로 롤백 ]                  ← Outline           │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  진행 중인 배포: (없음) | jobId 20260515-... 진행 중           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ (로그 tail, monospace, 검정 텍스트)                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  최근 배포 이력 (10건)                                       │
│  ┌──────┬─────┬─────────┬──────┬──────┬─────────┬───────┐  │
│  │ 시각 │ 종류│ pre→post│ actor│ 결과 │ 시간    │ 로그  │  │
│  └──────┴─────┴─────────┴──────┴──────┴─────────┴───────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 디자인 규칙 (`CLAUDE.md` §6 준수)
- 모든 모서리 `rounded-none`, shadow 없음, gradient 없음.
- 메인 배경은 화이트, 본문은 블랙 텍스트.
- 진행 중 단계 표시 점/배지에 한해 액센트 블루(`--color-accent: #2563FF`) 소량 사용.
- 버튼은 Primary(블랙 솔리드) / Outline.
- 로그 영역은 `bg-[var(--color-bg-muted)]` + monospace + overflow-auto.

---

## 9. 보안 / 에러 처리

### 인증
- 모든 `/api/admin/deploy/*` 핸들러 첫 줄: `const session = await readSession(); if (!session) return new Response(null, { status: 401 });`
- `actor = session.u` 로 DB 기록.

### 입력 검증
- `jobId`: `/^[0-9]{8}-[0-9]{6}-[a-f0-9]{6}$/` 정규식. 디렉토리 탈출(`../`) 차단.
- 롤백 `target_hash`: `/^[a-f0-9]{7,40}$/` 정규식 + DB 화이트리스트(과거 `deploy_history.status='success'` row 중 어느 하나의 `pre_head` 또는 `post_head` 와 일치) + `git cat-file -e <hash>` 존재 확인.

### CSRF
- 같은 origin POST + `sameSite: 'strict'` cookie (`bs_admin`). 1차 테스트엔 추가 토큰 생략.

### Rate limit
- lock으로 사실상 차단되지만 명시적으로 같은 actor 1초 내 재호출 시 429.

### 셸 안전
- `spawn('bash', [scriptPath, jobId], ...)` — argv 분리. `exec(string)` / `shell: true` 금지.
- `scripts/deploy.sh` 안에서 모든 변수는 `"$1"`처럼 quoted. `set -euo pipefail` 의무.

### 권한 / SELinux
- `/var/log/bandsustain-deploy/` 디렉토리: `ec2-user:ec2-user 755`, 파일 `644`.
- SELinux 컨텍스트는 `var_log_t` (기본). httpd가 안 만지므로 httpd 컨텍스트 불필요. setup 시 `restorecon` 한 번.

### 고아 프로세스 방지
- `spawn({ detached: true, stdio: 'ignore' })` + `child.unref()` + 자식 셸 첫 줄 `set -m` 비활성 + `trap` 로 흔적 정리.

### 로그 크기
- 통상 jobId당 < 200KB. 보관 30일, 이후 자동 삭제(별도 cron, 후순위).

---

## 10. 테스트 전략

### 단위 (vitest)
- `lib/deploy.ts`: jobId 정규식, lock fd 헬퍼(실제 파일), 로그 줄 파싱(STEP/STEP_OK/RESULT)
- `lib/deploy-db.ts`: mysql2 mock으로 SQL/파라미터 검증
- API 핸들러: 401(unauth), 400(invalid jobId), 409(이미 진행 중), 202(성공 spawn)

### 스크립트 (bats 또는 shell test)
- `scripts/deploy.sh --dry-run` 플래그 추가 (git/pnpm/pm2 호출 자리에 echo)
- 인자/플로우만 검증

### 통합 (수동)
- 무해한 commit push 후 [배포] → 로그/DB/HEAD 확인
- 구문 오류 commit → fail_step=pnpm_build, 운영 무영향
- `HEALTH_URL` 잠시 잘못 설정 → fail_step=smoke, 빨간 배너
- 동시 클릭 → 409 + 기존 jobId 인계
- 롤백 → pre_head 복귀 확인

### 불변식 검증
- **INV-1:** 동시 spawn 시 실제로 한 번만 실행됨 (lock 파일 mtime/PID 1개)
- **INV-2:** 모든 종료 경로에서 `## RESULT` 라인 존재 (grep 카운트)
- **INV-3:** status='running' AND lock 미점유 row → sweep 실행 후 'interrupted'

---

## 11. 마이그레이션 / 셋업 단계

1. DB 스키마 `db/schema/011_deploy_history.sql` 적용 (`SORITUNECOM_BANDSUSTAIN`)
2. `/var/log/bandsustain-deploy/` 디렉토리 생성, `chown ec2-user:ec2-user 755`, `restorecon` 1회
3. `scripts/deploy.sh` 배포 + `chmod +x`
4. `AdminNav` 에 Deploy 탭 추가
5. (선택) `deploy-sweep.sh` cron 1분 등록

---

## 12. 향후 확장 (비범위)

- 멀티사이트 통합 대시보드 (bandsustain 패턴 검증 후 junior/pt/boot/routines 이식)
- dev/prod 두 환경 분리 사이트(boot/pt/junior/routines): "dev에 반영" / "운영에 반영" 두 버튼 + 메모리 정책상 PROD는 사용자 명시 확인 모달 의무
- 멀티사이트로 갈 때는 worker 데몬 분리(접근 방식 안 C로 진화) 또는 systemd-template 검토
- 자동 롤백(smoke 실패 시 옵션)
- Slack/카카오 알림 (배포 시작/완료/실패)
- 환경변수/시크릿 UI 관리
