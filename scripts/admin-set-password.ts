import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: pnpm tsx scripts/admin-set-password.ts <password>");
  process.exit(1);
}
if (password.length < 12) {
  console.error("ERROR: password must be at least 12 chars");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
const sessionSecret = randomBytes(32).toString("hex");

console.log("");
console.log("# .db_credentials 에 아래 3줄을 추가하세요 (ADMIN_USERNAME은 본인 ID로 교체):");
console.log("");
console.log("ADMIN_USERNAME=<운영자 ID>");
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log(`ADMIN_SESSION_SECRET=${sessionSecret}`);
console.log("");
console.log("주의: 파일 소유자는 ec2-user:ec2-user, 권한은 600 이어야 합니다.");
