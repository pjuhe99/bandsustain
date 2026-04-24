export type Member = {
  id: string;
  nameEn: string;
  nameKr: string;
  position: string;
  photo: string;
  favoriteArtist?: string;
  favoriteSong?: string;
  order?: number;
};

export const members: Member[] = [
  {
    id: "01",
    nameEn: "Yeongmin Kim",
    nameKr: "김영민",
    position: "Song writer / Vocal / Guitar",
    photo: "/members/member01.jpg",
    favoriteArtist: "Oasis / John Mayer",
    favoriteSong: "Don't look back in anger / Waiting on the world to change",
  },
  {
    id: "02",
    nameEn: "Minjae Kim",
    nameKr: "김민재",
    position: "Song writer / Vocal / Guitar",
    photo: "/members/member02.jpg",
    favoriteArtist: "Oasis",
    favoriteSong: "Slide away",
  },
  {
    id: "03",
    nameEn: "Mihee Cho",
    nameKr: "조미희",
    position: "Bass",
    photo: "/members/member03.jpg",
    favoriteArtist: "우원재",
    favoriteSong: "호불호",
  },
  {
    id: "04",
    nameEn: "Seongsu Hong",
    nameKr: "홍성수",
    position: "Drums",
    photo: "/members/member04.jpg",
    favoriteArtist: "John Mayer",
    favoriteSong: "Slow dancing in a burning room",
  },
  {
    id: "05",
    nameEn: "Hyungseung Lee",
    nameKr: "이형승",
    position: "Keyboard",
    photo: "/members/member05.jpg",
    favoriteArtist: "Oasis / Blur",
    favoriteSong: "Live forever / Coffee and TV",
  },
  {
    id: "06",
    nameEn: "Yevin Kim",
    nameKr: "김예빈",
    position: "Drums",
    photo: "/members/member06.jpg",
    favoriteArtist: "緑黄色社会*녹황색사회 / 쏜애플",
    favoriteSong: "完全感覚Dreamer / 秒針を噛む",
  },
  {
    id: "07",
    nameEn: "Sangjun Kim",
    nameKr: "김상준",
    position: "Drums / Support",
    photo: "/members/member07.jpg",
    favoriteArtist: "Radiohead / The Beatles",
    favoriteSong: "Let down / Penny lane",
  },
  {
    id: "08",
    nameEn: "Sihyun Ham",
    nameKr: "함시현",
    position: "Manager / Designer / Support",
    photo: "/members/member08.jpg",
    favoriteArtist: "Oasis / Coldplay",
    favoriteSong: "Champagne supernova / Fix you",
  },
  {
    id: "09",
    nameEn: "Raehyuk Jung",
    nameKr: "정래혁",
    position: "Designer / Support",
    photo: "/members/member09.jpg",
    favoriteArtist: "The Beatles / 잔나비",
    favoriteSong: "Tomorrow Never Knows / 꿈과 책과 힘과 벽",
  },
];

export const sortedMembers = (): Member[] =>
  [...members].sort((a, b) => {
    const ao = a.order ?? Number.parseInt(a.id, 10);
    const bo = b.order ?? Number.parseInt(b.id, 10);
    return ao - bo;
  });
