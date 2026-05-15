import Image from "next/image";

type Props = { profileImagePath?: string | null };

export default function TypingIndicator({ profileImagePath }: Props) {
  return (
    <div className="flex w-full gap-2 justify-start">
      <div className="shrink-0 w-9 h-9 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
        {profileImagePath ? (
          <Image
            src={profileImagePath}
            alt="김영민 봇"
            width={36}
            height={36}
            className="w-9 h-9 object-cover"
          />
        ) : (
          <span className="block w-9 h-9 text-center leading-9 text-xs text-[var(--color-text-muted)]">
            김
          </span>
        )}
      </div>
      <div className="rounded-2xl px-4 py-3 bg-[var(--color-bg-muted)]">
        <span className="inline-flex gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse" />
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse"
            style={{ animationDelay: "300ms" }}
          />
        </span>
      </div>
    </div>
  );
}
