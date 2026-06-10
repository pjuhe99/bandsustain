export type InstagramConnection = {
  username: string;
  profileUrl: string;          // https://www.instagram.com/{username}/ 로 재생성된 값
  followedAt: string | null;   // "YYYY-MM-DDTHH:mm:00" (로컬 naive) 파싱 실패 시 null
  followedAtRaw: string | null; // 원문 보존
};

export type ParseOutcome = {
  connections: InstagramConnection[];
  failedCount: number; // 인스타 링크였지만 username 추출 실패한 항목 수
};

export type AccountRelation = {
  username: string;
  profileUrl: string;
  isFollower: boolean;          // 나를 팔로우함
  isFollowing: boolean;         // 내가 팔로우함
  followerSince: string | null; // 나를 팔로우한 날 (ISO)
  followerSinceRaw: string | null;
  followingSince: string | null; // 내가 팔로우한 날 (ISO)
  followingSinceRaw: string | null;
};

export type RelationResult = {
  followers: AccountRelation[];
  following: AccountRelation[];
  mutuals: AccountRelation[];
  notFollowingMeBack: AccountRelation[]; // 내가 팔로우, 상대는 안 함 (핵심 탭)
  iDoNotFollowBack: AccountRelation[];   // 상대가 팔로우, 나는 안 함
};

export type AnalysisResult = {
  relations: RelationResult;
  hasFollowers: boolean;   // followers 파일 존재 여부 (부분 데이터 안내용)
  hasFollowing: boolean;
  parseFailedCount: number;
  sustain: { following: boolean; since: string | null; sinceRaw: string | null };
  analyzedAt: string; // ISO
};

export type AnalysisErrorCode =
  | "NOT_ZIP"
  | "TOO_LARGE"
  | "ENCRYPTED_ZIP"
  | "FILES_NOT_FOUND"
  | "PARSE_FAILED";

export class AnalysisError extends Error {
  constructor(public code: AnalysisErrorCode, message?: string) {
    super(message ?? code);
  }
}
