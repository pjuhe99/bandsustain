export type BgmTrack = {
  src: string;
  title: string;
  /** 256x256 정사각 커버. 없으면 UI 가 로고 폴백을 그린다. */
  cover?: string;
};

export const BGM_TRACKS: BgmTrack[] = [
  { src: "/bgm/isekai.mp3", title: "이세계로 초대할게", cover: "/bgm/isekai.jpg" },
  { src: "/bgm/kkumgyeol.mp3", title: "꿈결에서", cover: "/bgm/kkumgyeol.jpg" },
  { src: "/bgm/shine-is-mine.mp3", title: "Shine is Mine", cover: "/bgm/shine-is-mine.jpg" },
  { src: "/bgm/singing.mp3", title: "Singing" },
  { src: "/bgm/byeolkkum.mp3", title: "별꿈", cover: "/bgm/byeolkkum.jpg" },
  { src: "/bgm/mudongryeok.m4a", title: "무동력" },
  { src: "/bgm/gwichanism.m4a", title: "귀차니즘" },
];
