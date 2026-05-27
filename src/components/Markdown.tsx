// `node: _` destructures below are intentional: strip the hast Element from
// props before spreading onto DOM elements to avoid React unknown-prop warnings.
// The project eslint config has no argsIgnorePattern, so disable here.
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { JSX } from "react";
import type { ExtraProps } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sanitizeMarkdownUrl } from "@/lib/markdownUrl";

// Helper: component props for a DOM element with `node` stripped so it is
// safe to spread onto an intrinsic element without React unknown-prop warnings.
type DP<T extends keyof JSX.IntrinsicElements> = Omit<
  JSX.IntrinsicElements[T] & ExtraProps,
  "node"
>;

// Renders trusted (admin-authored) markdown. raw HTML is NOT enabled
// (react-markdown default) and URLs pass through a scheme whitelist.
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="text-base md:text-lg leading-[1.75] break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => sanitizeMarkdownUrl(url)}
        components={{
          // h1 renders as h2 to avoid duplicate <h1> in page hierarchy
          h1: (props) => {
            const { node: _, ...p } = props as DP<"h2"> & ExtraProps;
            return <h2 className="font-display font-bold text-2xl md:text-3xl mt-10 mb-4 tracking-tight" {...p} />;
          },
          h2: (props) => {
            const { node: _, ...p } = props as DP<"h2"> & ExtraProps;
            return <h2 className="font-display font-bold text-2xl md:text-3xl mt-10 mb-4 tracking-tight" {...p} />;
          },
          h3: (props) => {
            const { node: _, ...p } = props as DP<"h3"> & ExtraProps;
            return <h3 className="font-bold text-lg md:text-xl mt-8 mb-3" {...p} />;
          },
          p: (props) => {
            const { node: _, ...p } = props as DP<"p"> & ExtraProps;
            return <p className="mb-6" {...p} />;
          },
          a: (props) => {
            const { node: _, href, ...p } = props as DP<"a"> & ExtraProps;
            const external = !!href && /^https?:/i.test(href);
            return (
              <a
                href={href}
                className="underline underline-offset-4 hover:decoration-2"
                {...(external ? { target: "_blank", rel: "nofollow noopener noreferrer" } : {})}
                {...p}
              />
            );
          },
          ul: (props) => {
            const { node: _, ...p } = props as DP<"ul"> & ExtraProps;
            return <ul className="list-disc pl-6 mb-6 space-y-1" {...p} />;
          },
          ol: (props) => {
            const { node: _, ...p } = props as DP<"ol"> & ExtraProps;
            return <ol className="list-decimal pl-6 mb-6 space-y-1" {...p} />;
          },
          li: (props) => {
            const { node: _, ...p } = props as DP<"li"> & ExtraProps;
            return <li className="leading-[1.7]" {...p} />;
          },
          blockquote: (props) => {
            const { node: _, ...p } = props as DP<"blockquote"> & ExtraProps;
            return (
              <blockquote
                className="border-l-4 border-[var(--color-border-strong)] pl-4 italic text-[var(--color-text-muted)] my-6"
                {...p}
              />
            );
          },
          code: (props) => {
            const { node: _, className, ...p } = props as DP<"code"> & ExtraProps;
            return (
              <code
                className={"bg-[var(--color-bg-muted)] px-1.5 py-0.5 text-[0.9em] " + (className ?? "")}
                {...p}
              />
            );
          },
          pre: (props) => {
            const { node: _, ...p } = props as DP<"pre"> & ExtraProps;
            return <pre className="bg-[var(--color-bg-muted)] p-4 overflow-x-auto text-sm mb-6" {...p} />;
          },
          img: (props) => {
            const { src, alt } = props as DP<"img"> & ExtraProps;
            if (!src || typeof src !== "string") return null;
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={src} alt={alt ?? ""} className="max-w-full h-auto my-6" loading="lazy" />;
          },
          hr: () => <hr className="my-10 border-[var(--color-border)]" />,
          table: (props) => {
            const { node: _, ...p } = props as DP<"table"> & ExtraProps;
            return (
              <div className="overflow-x-auto my-6">
                <table className="w-full text-sm border-collapse" {...p} />
              </div>
            );
          },
          th: (props) => {
            const { node: _, ...p } = props as DP<"th"> & ExtraProps;
            return <th className="border border-[var(--color-border)] px-3 py-2 text-left bg-[var(--color-bg-muted)]" {...p} />;
          },
          td: (props) => {
            const { node: _, ...p } = props as DP<"td"> & ExtraProps;
            return <td className="border border-[var(--color-border)] px-3 py-2" {...p} />;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
