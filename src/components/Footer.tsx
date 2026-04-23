const columns = [
  {
    heading: "Explore",
    items: [
      { href: "/news", label: "News" },
      { href: "/music", label: "Music" },
      { href: "/live", label: "Live" },
      { href: "/about", label: "About" },
    ],
  },
  {
    heading: "Follow",
    items: [
      { href: "#", label: "Instagram" },
      { href: "#", label: "YouTube" },
      { href: "#", label: "Spotify" },
      { href: "#", label: "Apple Music" },
    ],
  },
  {
    heading: "Contact",
    items: [{ href: "mailto:hello@bandsustain.com", label: "hello@bandsustain.com" }],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-[#f5f5f5] mt-auto">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <p className="font-display font-black text-xl uppercase mb-3">
            bandsustain
          </p>
          <p className="text-sm text-neutral-400 max-w-xs">
            Music, stories, and experiments. A home for sound that sustains.
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.heading}>
            <h4 className="text-xs uppercase tracking-widest text-neutral-400 mb-4">
              {col.heading}
            </h4>
            <ul className="space-y-2 text-sm">
              {col.items.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="hover:underline underline-offset-4"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 text-xs text-neutral-500">
          © {new Date().getFullYear()} bandsustain. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
