import Image from "next/image";
import Link from "next/link";
import { formatNewsDate, type NewsItem } from "@/data/news";

export default function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="flex flex-col">
      <Link href={`/news/${item.id}`} className="group">
        <div className="relative aspect-[3/2] bg-[var(--color-bg-muted)] mb-5 overflow-hidden flex items-center justify-center text-[var(--color-text-muted)] text-sm">
          {item.heroImage ? (
            <Image
              src={item.heroImage}
              alt={item.headline}
              fill
              sizes="(min-width: 768px) 33vw, 100vw"
              className="object-cover"
            />
          ) : (
            <span>Hero image</span>
          )}
        </div>
        <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
          {item.category} · {formatNewsDate(item.date)}
        </p>
        <h3 className="font-semibold text-lg md:text-xl underline underline-offset-4 decoration-1 group-hover:decoration-2">
          {item.headline}
        </h3>
      </Link>
    </article>
  );
}
