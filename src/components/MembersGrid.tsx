"use client";

import { useCallback, useEffect, useState } from "react";
import type { Member } from "@/data/members";
import MemberCard from "./MemberCard";

type Props = {
  members: Member[];
};

export default function MembersGrid({ members }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const handleToggle = useCallback((id: string) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  // Reset open state when hover capability changes (viewport crosses
  // into or out of hover-capable environments). Prevents a pinned
  // desktop card from rendering as open after resizing to a mobile
  // viewport, and vice versa.
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const handler = () => setOpenId(null);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
      {members.map((m) => (
        <MemberCard
          key={m.id}
          member={m}
          isOpen={openId === m.id}
          onToggle={() => handleToggle(m.id)}
        />
      ))}
    </div>
  );
}
