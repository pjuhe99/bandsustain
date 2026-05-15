import Image from "next/image";

type Props = {
  role: "user" | "assistant";
  content: string;
  profileImagePath?: string | null;
};

export default function MessageBubble({ role, content, profileImagePath }: Props) {
  const isBot = role === "assistant";
  return (
    <div className={`flex w-full gap-2 ${isBot ? "justify-start" : "justify-end"}`}>
      {isBot && (
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
      )}
      <div
        className={
          "max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed " +
          (isBot
            ? "bg-[var(--color-bg-muted)] text-[var(--color-text)]"
            : "bg-[var(--color-text)] text-[var(--color-bg)]")
        }
      >
        {content}
      </div>
    </div>
  );
}
