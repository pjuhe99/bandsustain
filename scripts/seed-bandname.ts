// scripts/seed-bandname.ts
// defaultDataset → bandname_* 테이블 멱등 시드. DEV DB 먼저.
//   set -a; source <site>/.db_credentials; set +a
//   sudo -u ec2-user env PATH="$PATH" pnpm bandname:seed
import mysql from "mysql2/promise";
import { defaultDataset } from "../src/lib/bandName/data";
import type { WordMap } from "../src/lib/bandName/types";

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
  });

  const wordRows: [string, string, string][] = [];
  const pushWords = (lang: "korean" | "english", map: WordMap) => {
    for (const [cat, list] of Object.entries(map)) {
      for (const w of list ?? []) wordRows.push([lang, cat, w]);
    }
  };
  pushWords("korean", defaultDataset.koreanWords);
  pushWords("english", defaultDataset.englishWords);
  for (const [lang, cat, w] of wordRows) {
    await conn.query(
      "INSERT IGNORE INTO bandname_words (language, category, word) VALUES (?,?,?)",
      [lang, cat, w],
    );
  }

  const pushPatterns = async (lang: "korean" | "english", patterns: typeof defaultDataset.koreanPatterns) => {
    for (const p of patterns) {
      await conn.query(
        `INSERT INTO bandname_patterns
           (pattern_key, language, slots, scenes, moods, \`separator\`, min_weirdness, max_weirdness, weight)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           slots=VALUES(slots), scenes=VALUES(scenes), moods=VALUES(moods),
           \`separator\`=VALUES(\`separator\`), min_weirdness=VALUES(min_weirdness),
           max_weirdness=VALUES(max_weirdness), weight=VALUES(weight)`,
        [p.id, lang, JSON.stringify(p.slots), JSON.stringify(p.scenes),
         JSON.stringify(p.moods), p.separator, p.minWeirdness, p.maxWeirdness, p.weight],
      );
    }
  };
  await pushPatterns("korean", defaultDataset.koreanPatterns);
  await pushPatterns("english", defaultDataset.englishPatterns);

  for (const [a, b] of defaultDataset.preferredPairs) {
    await conn.query("INSERT IGNORE INTO bandname_pairs (kind, word_a, word_b) VALUES ('preferred',?,?)", [a, b]);
  }
  for (const [a, b] of defaultDataset.blockedPairs) {
    await conn.query("INSERT IGNORE INTO bandname_pairs (kind, word_a, word_b) VALUES ('blocked',?,?)", [a, b]);
  }
  for (const name of defaultDataset.blockedExactNames) {
    await conn.query("INSERT IGNORE INTO bandname_blocked_names (name) VALUES (?)", [name]);
  }

  const [[counts]] = await conn.query<any>(
    `SELECT
       (SELECT COUNT(*) FROM bandname_words) AS words,
       (SELECT COUNT(*) FROM bandname_patterns) AS patterns,
       (SELECT COUNT(*) FROM bandname_pairs) AS pairs,
       (SELECT COUNT(*) FROM bandname_blocked_names) AS names`,
  );
  console.log("seeded:", counts, "| source words:", wordRows.length,
    "patterns:", defaultDataset.koreanPatterns.length + defaultDataset.englishPatterns.length);
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
