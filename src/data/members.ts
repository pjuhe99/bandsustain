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
    nameEn: "SAMPLE NAME ONE",
    nameKr: "샘플일",
    position: "Vocal",
    photo: "/members/member01.jpg",
    favoriteArtist: "Sample Artist",
    favoriteSong: "Sample Song",
  },
  {
    id: "02",
    nameEn: "SAMPLE NAME TWO",
    nameKr: "샘플이",
    position: "Guitar/Vocal",
    photo: "/members/member02.jpg",
    favoriteArtist: "Another Artist",
    favoriteSong: "Another Song",
  },
  {
    id: "03",
    nameEn: "SAMPLE NAME THREE",
    nameKr: "샘플삼",
    position: "Bass",
    photo: "/members/member03.jpg",
  },
];

export const sortedMembers = (): Member[] =>
  [...members].sort((a, b) => {
    const ao = a.order ?? Number.parseInt(a.id, 10);
    const bo = b.order ?? Number.parseInt(b.id, 10);
    return ao - bo;
  });
