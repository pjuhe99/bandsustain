# bandsustain DEV 환경 구축 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bandsustain.com 에 운영(PROD)과 분리된 개발(DEV) 환경(`dev.bandsustain.com`)을 구축하여 dev 브랜치 작업 → 검증 → 명시 승인 시에만 운영 반영하는 플로우를 도입한다.

**Architecture:** PROD(`_______site_BANDSUSTAIN`, 포트 3100, DB `BANDSUSTAIN`, main 브랜치)를 그대로 복제한 DEV(`_______site_BANDSUSTAIN_DEV`, 포트 3101, DB `BANDSUSTAIN_DEV`, dev 브랜치)를 만든다. 동일 GitHub repo 의 신규 `dev` 브랜치, 별도 PM2 프로세스, 별도 Apache vhost + Let's Encrypt 인증서를 사용한다. routines/PT 의 dev-prod 분리 패턴을 따른다.

**Tech Stack:** Next.js 16 + React 19 + pnpm + PM2 (node v20), MariaDB, Apache(mod_proxy), Let's Encrypt(certbot), SELinux.

**참조 spec:** `docs/superpowers/specs/2026-05-23-bandsustain-dev-environment-design.md`

**전제 (확인 완료):** `dev.bandsustain.com` → `3.37.213.224` DNS 전파 완료. 포트 3101 미사용. ec2-user `~/.ssh/config` 에 `github-bandsustain` alias 존재.

**용어:**
- `PROD_SITE` = `/var/www/html/_______site_BANDSUSTAIN`
- `PROD_APP` = `/var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain`
- `DEV_SITE` = `/var/www/html/_______site_BANDSUSTAIN_DEV`
- `DEV_APP` = `/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain`

---

### Task 1: DEV 디렉토리 구조 + 심볼릭 링크 + repo 클론

**Files:**
- Create dir: `/var/www/html/_______site_BANDSUSTAIN_DEV/{public_html,logs}`
- Create symlink: `/root/bandsustain-dev` → `DEV_SITE`
- Clone into: `DEV_APP`

- [ ] **Step 1: DEV 사이트 디렉토리 생성 (ec2-user 소유)**

```bash
mkdir -p /var/www/html/_______site_BANDSUSTAIN_DEV/public_html
mkdir -p /var/www/html/_______site_BANDSUSTAIN_DEV/logs
chown -R ec2-user:ec2-user /var/www/html/_______site_BANDSUSTAIN_DEV
```

- [ ] **Step 2: ec2-user 로 repo 클론 (SSH alias 사용)**

```bash
sudo -u ec2-user git clone git@github-bandsustain:pjuhe99/bandsustain.git \
  /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
```
Expected: `Cloning into ...` 후 main 체크아웃 완료. 에러 없이 종료.

- [ ] **Step 3: 심볼릭 링크 생성**

```bash
ln -s /var/www/html/_______site_BANDSUSTAIN_DEV /root/bandsustain-dev
```

- [ ] **Step 4: 검증 — 구조/소유권/원격 확인**

```bash
ls -ld /root/bandsustain-dev
ls -la /var/www/html/_______site_BANDSUSTAIN_DEV
sudo -u ec2-user git -C /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain remote -v
sudo -u ec2-user git -C /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain branch -a
```
Expected: 심볼릭 링크 존재, 디렉토리 전부 `ec2-user:ec2-user`, remote `github-bandsustain`, 브랜치 `main` + `origin/main` + `origin/work`.

---

### Task 2: `dev` 브랜치 생성 + spec/plan 문서 커밋 + push

**Files:**
- Relocate: spec/plan 문서 → `DEV_APP/docs/superpowers/{specs,plans}/`
- Cleanup: PROD_APP 의 untracked 문서 제거
- Branch: `dev` (origin push)

- [ ] **Step 1: DEV 클론에서 dev 브랜치 생성**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
sudo -u ec2-user git checkout -b dev
```
Expected: `Switched to a new branch 'dev'`

- [ ] **Step 2: spec/plan 문서를 DEV 클론으로 복사**

```bash
sudo -u ec2-user mkdir -p /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain/docs/superpowers/specs
sudo -u ec2-user mkdir -p /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain/docs/superpowers/plans
sudo -u ec2-user cp /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain/docs/superpowers/specs/2026-05-23-bandsustain-dev-environment-design.md \
  /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain/docs/superpowers/specs/
sudo -u ec2-user cp /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain/docs/superpowers/plans/2026-05-23-bandsustain-dev-environment.md \
  /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain/docs/superpowers/plans/
```

- [ ] **Step 3: 커밋 + push origin dev**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
sudo -u ec2-user git add docs/superpowers/specs/2026-05-23-bandsustain-dev-environment-design.md docs/superpowers/plans/2026-05-23-bandsustain-dev-environment.md
sudo -u ec2-user git commit -m "docs: bandsustain DEV 환경 구축 spec + plan

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
sudo -u ec2-user git push -u origin dev
```
Expected: `dev -> dev` push 성공, origin 에 dev 브랜치 생성.

- [ ] **Step 4: PROD working tree 의 untracked 문서 정리**

PROD 에 브레인스토밍 중 작성된 untracked 문서가 남아 있으면 제거 (PROD main 은 건드리지 않음, untracked 파일만).
```bash
git -C /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain status --porcelain docs/superpowers/
rm -f /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain/docs/superpowers/specs/2026-05-23-bandsustain-dev-environment-design.md
rm -f /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain/docs/superpowers/plans/2026-05-23-bandsustain-dev-environment.md
```
Expected: status 에서 해당 파일이 `??` (untracked) 였음을 확인 후 삭제. PROD 가 tracked 로 표시하면 중단하고 보고.

- [ ] **Step 5: 검증**

```bash
sudo -u ec2-user git -C /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain branch -vv
git -C /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain branch
```
Expected: DEV 가 `dev` 브랜치(추적 origin/dev), PROD 가 `main` 그대로.

---

### Task 3: `BANDSUSTAIN_DEV` DB 생성 + PROD 전체 복사 + 권한 부여

**Files:** 없음 (DB 작업)

- [ ] **Step 1: 소스 DB charset/collation 확인**

```bash
sudo mysql -N -e "SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='BANDSUSTAIN';"
```
Expected: 예) `utf8mb4  utf8mb4_general_ci` (실제 출력값을 다음 단계에 사용).

- [ ] **Step 2: DEV DB 생성 (소스와 동일 charset/collation)**

```bash
# 아래 utf8mb4 / utf8mb4_general_ci 는 Step 1 출력으로 치환
sudo mysql -e "CREATE DATABASE IF NOT EXISTS BANDSUSTAIN_DEV CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
```

- [ ] **Step 3: PROD → DEV 전체 덤프 복사 (PII 포함)**

```bash
sudo bash -c "mysqldump --single-transaction --routines --triggers --no-tablespaces BANDSUSTAIN | mysql BANDSUSTAIN_DEV"
```
Expected: 에러 없이 종료.

- [ ] **Step 4: DB_USER 에 DEV DB 권한 부여**

```bash
sudo mysql -e "GRANT ALL PRIVILEGES ON BANDSUSTAIN_DEV.* TO 'BANDSUSTAIN'@'localhost'; FLUSH PRIVILEGES;"
```

- [ ] **Step 5: 검증 — 테이블 수 일치 + 멤버 행 수 비교**

```bash
echo "PROD tables:"; sudo mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='BANDSUSTAIN';"
echo "DEV  tables:"; sudo mysql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='BANDSUSTAIN_DEV';"
echo "PROD members:"; sudo mysql -N -e "SELECT COUNT(*) FROM BANDSUSTAIN.members;"
echo "DEV  members:"; sudo mysql -N -e "SELECT COUNT(*) FROM BANDSUSTAIN_DEV.members;"
```
Expected: PROD/DEV 테이블 수 동일, members 행 수 동일.

---

### Task 4: DEV 자격증명 / 환경 / PM2 설정 파일 작성

**Files:**
- Create: `DEV_SITE/.db_credentials` (ec2-user:ec2-user 600)
- Create: `DEV_APP/.env.local` (ec2-user:ec2-user 640)
- Modify: `DEV_APP/ecosystem.config.js`

- [ ] **Step 1: PROD .db_credentials 복사 후 DEV 값으로 수정**

```bash
sudo cp /var/www/html/_______site_BANDSUSTAIN/.db_credentials /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials
# DB_NAME 을 DEV 로 변경
sudo sed -i 's/^DB_NAME=.*/DB_NAME=BANDSUSTAIN_DEV/' /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials
# ADMIN_SESSION_SECRET, ANALYTICS_SECRET 만 DEV 신규 생성 (ENCRYPTION_KEY/ADMIN_PASSWORD_HASH 등은 PROD 유지)
NEW_SESSION=$(openssl rand -hex 32)
NEW_ANALYTICS=$(openssl rand -hex 32)
sudo sed -i "s|^ADMIN_SESSION_SECRET=.*|ADMIN_SESSION_SECRET=${NEW_SESSION}|" /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials
sudo sed -i "s|^ANALYTICS_SECRET=.*|ANALYTICS_SECRET=${NEW_ANALYTICS}|" /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials
sudo chown ec2-user:ec2-user /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials
sudo chmod 600 /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials
```

- [ ] **Step 2: 검증 — DB_NAME 변경 + ENCRYPTION_KEY 동일 확인**

```bash
echo "DEV DB_NAME:"; sudo grep '^DB_NAME=' /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials
echo "ENC keys identical?:"; \
  [ "$(sudo grep '^ENCRYPTION_KEY=' /var/www/html/_______site_BANDSUSTAIN/.db_credentials)" = \
    "$(sudo grep '^ENCRYPTION_KEY=' /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials)" ] \
  && echo "YES (same)" || echo "NO (MISMATCH - STOP)"
echo "secrets differ?:"; \
  [ "$(sudo grep '^ADMIN_SESSION_SECRET=' /var/www/html/_______site_BANDSUSTAIN/.db_credentials)" != \
    "$(sudo grep '^ADMIN_SESSION_SECRET=' /var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials)" ] \
  && echo "YES (dev has new session secret)" || echo "NO (still same - check)"
```
Expected: `DB_NAME=BANDSUSTAIN_DEV`, ENCRYPTION_KEY `YES (same)`, session secret `YES`.

- [ ] **Step 3: .env.local 복사**

```bash
sudo cp /var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain/.env.local \
  /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain/.env.local
sudo chown ec2-user:ec2-user /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain/.env.local
sudo chmod 640 /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain/.env.local
```

- [ ] **Step 4: ecosystem.config.js 를 DEV 용으로 작성**

`DEV_APP/ecosystem.config.js` 전체를 아래로 교체:
```javascript
module.exports = {
  apps: [
    {
      name: "bandsustain-dev",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: "node",
      cwd: "/var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain",
      env: {
        NODE_ENV: "production",
        PORT: 3101,
        DB_CREDENTIALS_PATH: "/var/www/html/_______site_BANDSUSTAIN_DEV/.db_credentials",
      },
    },
  ],
};
```
작성 후 소유권 보정:
```bash
sudo chown ec2-user:ec2-user /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain/ecosystem.config.js
```

> 주의: 이 파일은 dev 브랜치 working tree 의 추적 파일(ecosystem.config.js)을 수정하는 것. 커밋 여부는 Task 9 이후 별도 판단 (DEV-only 설정이라 dev 브랜치에 커밋하면 main 머지 시 PROD 로 새어나갈 위험 → 커밋하지 말고 working tree 로컬 수정으로만 유지). `git update-index --skip-worktree` 로 추적 제외:
```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
sudo -u ec2-user git update-index --skip-worktree ecosystem.config.js
```

- [ ] **Step 5: 검증 — ecosystem 값 + git 무시 확인**

```bash
grep -E "name:|PORT:|DB_CREDENTIALS_PATH:" /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain/ecosystem.config.js
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain && sudo -u ec2-user git status --porcelain ecosystem.config.js
```
Expected: name `bandsustain-dev`, PORT 3101, DB_CREDENTIALS_PATH DEV 경로. git status 에 ecosystem.config.js 변경이 안 보임(skip-worktree).

---

### Task 5: 의존성 설치 + 빌드

**Files:** 없음 (빌드 산출물 `.next/`)

- [ ] **Step 1: pnpm install (ec2-user, frozen lockfile)**

```bash
cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain
sudo -u ec2-user bash -lc 'cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain && pnpm install --frozen-lockfile'
```
Expected: 설치 완료, 에러 없음.

- [ ] **Step 2: pnpm build (ec2-user)**

```bash
sudo -u ec2-user bash -lc 'cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain && pnpm build'
```
Expected: `✓ Compiled successfully`, `.next/` 생성.

- [ ] **Step 3: 검증 — root 소유 파일 없음 확인 (footgun 가드)**

```bash
find /var/www/html/_______site_BANDSUSTAIN_DEV -user root -not -path '*/.git/*' 2>/dev/null | head
```
Expected: 출력 없음. 있으면 `chown -R ec2-user:ec2-user /var/www/html/_______site_BANDSUSTAIN_DEV` 로 보정.

---

### Task 6: SELinux logs 컨텍스트 설정

**Files:** 없음 (SELinux fcontext)

- [ ] **Step 1: DEV logs 디렉토리에 httpd_log_t 영구 규칙 + 적용**

```bash
sudo semanage fcontext -a -t httpd_log_t "/var/www/html/_______site_BANDSUSTAIN_DEV/logs(/.*)?"
sudo restorecon -Rv /var/www/html/_______site_BANDSUSTAIN_DEV/logs
```

- [ ] **Step 2: 검증 — 컨텍스트 비교 (PROD 와 동일해야)**

```bash
ls -dZ /var/www/html/_______site_BANDSUSTAIN/logs
ls -dZ /var/www/html/_______site_BANDSUSTAIN_DEV/logs
```
Expected: 둘 다 `httpd_log_t`.

---

### Task 7: PM2 프로세스 등록 (포트 3101)

**Files:** 없음 (PM2 런타임)

- [ ] **Step 1: ec2-user PM2 로 bandsustain-dev 기동**

```bash
sudo -u ec2-user bash -lc 'cd /var/www/html/_______site_BANDSUSTAIN_DEV/public_html/bandsustain && pm2 start ecosystem.config.js'
```
Expected: `bandsustain-dev` online.

- [ ] **Step 2: PM2 프로세스 목록 저장 (재부팅 복원)**

```bash
sudo -u ec2-user pm2 save
```

- [ ] **Step 3: 검증 — 프로세스 online + 포트 LISTEN + 로컬 응답 + DEV DB 사용 확인**

```bash
sudo -u ec2-user pm2 list | grep -E 'bandsustain($|-dev)'
ss -ltnp 2>/dev/null | grep ':3101' && echo "3101 LISTEN OK"
curl -s -o /dev/null -w "local 3101 -> %{http_code}\n" http://127.0.0.1:3101/
sudo -u ec2-user pm2 env $(sudo -u ec2-user pm2 id bandsustain-dev | tr -d '[]') 2>/dev/null | grep -E 'PORT|DB_CREDENTIALS_PATH' || \
  sudo -u ec2-user pm2 describe bandsustain-dev | grep -iE 'DB_CREDENTIALS_PATH|PORT'
```
Expected: bandsustain(3100) + bandsustain-dev(3101) 둘 다 online, 3101 LISTEN, HTTP 200/3xx, env 에 DEV creds 경로/포트 확인.

---

### Task 8: Apache vhost + Let's Encrypt 인증서

**Files:**
- Create: `/etc/httpd/conf.d/dev.bandsustain.com.conf`
- Cert: `/etc/letsencrypt/live/dev.bandsustain.com/`

- [ ] **Step 1: 임시 HTTP(80) vhost 작성 (ACME 챌린지용)**

`/etc/httpd/conf.d/dev.bandsustain.com.conf` 작성:
```apache
<VirtualHost *:80>
    ServerName dev.bandsustain.com
    DocumentRoot /var/www/html/_______site_BANDSUSTAIN_DEV/public_html
    <Directory /var/www/html/_______site_BANDSUSTAIN_DEV/public_html>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    ErrorLog /var/www/html/_______site_BANDSUSTAIN_DEV/logs/error.log
    CustomLog /var/www/html/_______site_BANDSUSTAIN_DEV/logs/access.log combined
</VirtualHost>
```
```bash
sudo apachectl configtest && sudo systemctl reload httpd
```
Expected: `Syntax OK`, reload 성공.

- [ ] **Step 2: certbot webroot 로 인증서 발급**

```bash
sudo certbot certonly --webroot \
  -w /var/www/html/_______site_BANDSUSTAIN_DEV/public_html \
  -d dev.bandsustain.com \
  --non-interactive --agree-tos -m soritunenglish@gmail.com
```
Expected: `Successfully received certificate`, `/etc/letsencrypt/live/dev.bandsustain.com/fullchain.pem` 생성.

> 주의 ([[letsencrypt-webroot-documentroot-match]]): renewal conf 의 `webroot_path` 가 위 `-w` 경로(=vhost DocumentRoot)와 일치해야 자동 갱신이 깨지지 않는다. 발급 후 `/etc/letsencrypt/renewal/dev.bandsustain.com.conf` 의 webroot_path 확인.

- [ ] **Step 3: 전체 vhost 로 교체 (80→443 리다이렉트 + 443 프록시 → 3101)**

`/etc/httpd/conf.d/dev.bandsustain.com.conf` 전체를 아래로 교체:
```apache
# dev.bandsustain.com VirtualHost Configuration

<VirtualHost *:80>
    ServerName dev.bandsustain.com

    DocumentRoot /var/www/html/_______site_BANDSUSTAIN_DEV/public_html

    <Directory /var/www/html/_______site_BANDSUSTAIN_DEV/public_html>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteCond %{REQUEST_URI} !^/\.well-known/
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

    ErrorLog /var/www/html/_______site_BANDSUSTAIN_DEV/logs/error.log
    CustomLog /var/www/html/_______site_BANDSUSTAIN_DEV/logs/access.log combined
</VirtualHost>

<VirtualHost *:443>
    ServerName dev.bandsustain.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/dev.bandsustain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/dev.bandsustain.com/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3101/
    ProxyPassReverse / http://127.0.0.1:3101/

    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) ws://127.0.0.1:3101/$1 [P,L]

    ErrorLog /var/www/html/_______site_BANDSUSTAIN_DEV/logs/ssl_error.log
    CustomLog /var/www/html/_______site_BANDSUSTAIN_DEV/logs/ssl_access.log combined
</VirtualHost>
```
```bash
sudo apachectl configtest && sudo systemctl reload httpd
```
Expected: `Syntax OK`, reload 성공.

- [ ] **Step 4: 검증 — vhost 문법 + SELinux 로그 컨텍스트 재확인**

```bash
sudo apachectl configtest
ls -dZ /var/www/html/_______site_BANDSUSTAIN_DEV/logs
```
Expected: `Syntax OK`, logs `httpd_log_t`.

---

### Task 9: 스모크 테스트

**Files:** 없음 (검증)

- [ ] **Step 1: HTTPS 외부 응답 확인**

```bash
curl -s -o /dev/null -w "https dev -> %{http_code}\n" https://dev.bandsustain.com/
curl -sI https://dev.bandsustain.com/ | grep -i -E 'HTTP/|strict-transport|server' | head
echo "HTTP redirect:"; curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://dev.bandsustain.com/
```
Expected: HTTPS 200, HTTP 80 → 301 https.

- [ ] **Step 2: 인증서 도메인 확인**

```bash
echo | openssl s_client -servername dev.bandsustain.com -connect dev.bandsustain.com:443 2>/dev/null | openssl x509 -noout -subject -dates
```
Expected: subject `CN=dev.bandsustain.com`, 유효기간 정상.

- [ ] **Step 3: DEV 가 DEV DB 를 보는지 확인 (PROD 격리)**

DEV 앱이 DEV DB 에 연결되는지 — DEV DB members 행 수와, DEV 로그/응답으로 확인. (앱에 DB count 노출 엔드포인트가 없으면) DEV creds 경로가 PM2 env 에 설정됐고(Task 7) DEV DB 가 독립 존재함으로 갈음하되, 안전 추가 확인:
```bash
# DEV DB 에 sentinel 행을 넣지 않고, 연결 대상만 간접 확인: DEV 프로세스가 PROD creds 경로를 안 읽는지 lsof 로 확인
sudo -u ec2-user bash -lc 'pm2 jlist' | grep -o 'DB_CREDENTIALS_PATH[^,]*' | head
```
Expected: `DB_CREDENTIALS_PATH` 가 DEV 경로(`_______site_BANDSUSTAIN_DEV/.db_credentials`)로 출력.

- [ ] **Step 4: PROD 무영향 확인**

```bash
curl -s -o /dev/null -w "https prod -> %{http_code}\n" https://bandsustain.com/
sudo -u ec2-user pm2 list | grep -E 'bandsustain($|-dev)'
```
Expected: PROD 200, 두 프로세스 모두 online.

---

### Task 10: 메모리 기록

**Files:**
- Modify: `/root/.claude/projects/-root/memory/MEMORY.md`
- Create (옵션): 배포 플로우 상세 토픽 파일

- [ ] **Step 1: MEMORY.md 에 bandsustain dev-prod 섹션 추가**

PT/boot/routines 섹션과 동일 양식으로 bandsustain 섹션 추가:
- 디렉토리 표 (dev `/root/bandsustain-dev` / prod `/root/bandsustain`, 도메인 dev.bandsustain.com / bandsustain.com, 브랜치 dev/main, DB BANDSUSTAIN_DEV/BANDSUSTAIN, PM2 bandsustain-dev:3101 / bandsustain:3100)
- 작업 순서 4항목 + 배포 플로우 코드블록
- 주의: ecosystem.config.js 는 git skip-worktree (DEV-only), creds.ts 하드코딩 경로 → DB_CREDENTIALS_PATH 필수, ENCRYPTION_KEY DEV/PROD 동일, deploy-sweep cron 은 PROD 전용
- 기존 "bandsustain은 PM2 restart + push마다 classifier가 막음" 피드백 항목에 "dev 환경 구축으로 해소(2026-05-23)" 보강

- [ ] **Step 2: 검증**

```bash
grep -n "dev.bandsustain.com\|bandsustain-dev\|BANDSUSTAIN_DEV" /root/.claude/projects/-root/memory/MEMORY.md | head
```
Expected: 신규 항목 존재.

---

## Self-Review

- **Spec coverage:** 디렉토리/심볼릭(T1), git/dev브랜치(T2), DB복사(T3), creds/env/ecosystem+ENCRYPTION_KEY/DB_CREDENTIALS_PATH(T4), install/build+root-owned가드(T5), SELinux(T6), PM2 3101(T7), vhost+cert+webroot일치(T8), 스모크+PROD격리(T9), 메모리(T10). spec 7개 섹션 전부 태스크 매핑됨.
- **Placeholder scan:** Step 2(T3) charset 은 Step 1 출력으로 치환하라고 명시(실값 의존이라 불가피, 치환 위치 명확). 그 외 placeholder 없음.
- **Type/명칭 일관성:** 포트 3101, DB `BANDSUSTAIN_DEV`, 프로세스 `bandsustain-dev`, 경로 `_______site_BANDSUSTAIN_DEV`, DB_CREDENTIALS_PATH 전 태스크 일관.

## 알려진 리스크 / 실행 중 멈춤 지점
- **classifier 게이트:** bandsustain 액션은 push/PM2 restart 마다 막힐 수 있음([[bandsustain-classifier-prod-gates]]). DEV 구축 중에도 `git push origin dev`(T2), `pm2 start`(T7) 에서 각각 승인 필요할 수 있으니 실행자는 사용자에게 미리 안내.
- **certbot 발급(T8):** DNS 전파 확인됨. 실패 시 webroot 경로/80 vhost 도달성 점검.
- **ecosystem 커밋 금지:** DEV-only 설정이 main 으로 새지 않도록 skip-worktree(T4). PROD main 직접 커밋 절대 금지.
