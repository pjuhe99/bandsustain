"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPool } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { ALL_WORD_CATEGORIES } from "@/lib/bandName/types";

async function requireAuth() { if (!(await readSession())) throw new Error("UNAUTHENTICATED"); }
const GEN_PATH = "/playground/band-name-generator";
const SCENES = ["jrock", "hongdae", "punk", "citypop", "emo", "campus", "metal"] as const;
const MOODS = ["fresh", "dreamy", "wistful", "funny", "rough", "romantic"] as const;

const schema = z.object({
  patternKey: z.string().regex(/^[a-z0-9_]+$/, "소문자/숫자/밑줄만"),
  language: z.enum(["korean", "english"]),
  slots: z.array(z.enum(ALL_WORD_CATEGORIES as [string, ...string[]])).min(1),
  scenes: z.array(z.enum(SCENES)).min(1),
  moods: z.array(z.enum(MOODS)).min(1),
  separator: z.string().max(4),
  minWeirdness: z.coerce.number().int().min(1).max(5),
  maxWeirdness: z.coerce.number().int().min(1).max(5),
  weight: z.coerce.number().int().positive(),
}).refine((d) => d.minWeirdness <= d.maxWeirdness, { message: "min ≤ max", path: ["minWeirdness"] });

export type FormState = { error?: string };

function parse(fd: FormData) {
  return {
    patternKey: fd.get("patternKey"),
    language: fd.get("language"),
    slots: fd.getAll("slots"),
    scenes: fd.getAll("scenes"),
    moods: fd.getAll("moods"),
    separator: fd.get("separator") ?? "",
    minWeirdness: fd.get("minWeirdness"),
    maxWeirdness: fd.get("maxWeirdness"),
    weight: fd.get("weight"),
  };
}

export async function savePattern(_p: FormState, fd: FormData): Promise<FormState> {
  await requireAuth();
  const r = schema.safeParse(parse(fd));
  if (!r.success) return { error: r.error.issues[0]?.message ?? "검증 실패" };
  const d = r.data;
  await getPool().query(
    `INSERT INTO bandname_patterns
       (pattern_key, language, slots, scenes, moods, \`separator\`, min_weirdness, max_weirdness, weight)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       language=VALUES(language), slots=VALUES(slots), scenes=VALUES(scenes), moods=VALUES(moods),
       \`separator\`=VALUES(\`separator\`), min_weirdness=VALUES(min_weirdness),
       max_weirdness=VALUES(max_weirdness), weight=VALUES(weight)`,
    [d.patternKey, d.language, JSON.stringify(d.slots), JSON.stringify(d.scenes),
     JSON.stringify(d.moods), d.separator, d.minWeirdness, d.maxWeirdness, d.weight],
  );
  revalidatePath("/admin/band-name/patterns");
  revalidatePath(GEN_PATH);
  return {};
}

export async function deletePattern(id: number): Promise<void> {
  await requireAuth();
  await getPool().query("DELETE FROM bandname_patterns WHERE id=?", [id]);
  revalidatePath("/admin/band-name/patterns");
  revalidatePath(GEN_PATH);
}
