import { z } from "zod";

const optionalPositiveInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().positive().optional(),
);

const intWithDefault = (def: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? def : Number(v)),
    z.number().int(),
  );

export const commentInputSchema = z.object({
  nickname: z.string().trim().min(1, "닉네임을 입력하세요").max(40),
  body: z.string().trim().min(1, "내용을 입력하세요").max(1000, "1000자 이내"),
  password: z
    .union([z.string().min(4, "비밀번호는 4자 이상").max(72), z.literal("")])
    .optional(),
  website: z.string().optional(), // honeypot (route ignores non-empty)
});
export type CommentInput = z.infer<typeof commentInputSchema>;

export const topicSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(120),
  memberId: optionalPositiveInt,
  description: z.union([z.string().max(500), z.literal("")]).optional(),
  sortOrder: intWithDefault(0),
});
export type TopicInput = z.infer<typeof topicSchema>;

export const postSchema = z.object({
  topicId: z.preprocess((v) => Number(v), z.number().int().positive("주제를 선택하세요")),
  title: z.string().trim().min(1, "제목을 입력하세요").max(200),
  heroImage: z.union([z.string().max(255), z.literal("")]).optional(),
  excerpt: z.union([z.string().max(500), z.literal("")]).optional(),
  body: z.string().min(1, "본문을 입력하세요"),
});
export type PostInput = z.infer<typeof postSchema>;
