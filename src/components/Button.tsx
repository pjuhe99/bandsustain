import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "accent";

const base =
  "inline-flex items-center justify-center px-6 py-3 text-sm font-semibold uppercase tracking-wider transition-colors border focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-text)] text-[var(--color-bg)] border-[var(--color-text)] hover:bg-transparent hover:text-[var(--color-text)]",
  secondary:
    "bg-transparent text-[var(--color-text)] border-[var(--color-text)] hover:bg-[var(--color-text)] hover:text-[var(--color-bg)]",
  accent:
    "bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)] hover:opacity-90",
};

export function buttonClasses(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`.trim();
}

type Props = {
  variant?: ButtonVariant;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button className={buttonClasses(variant, className)} {...rest}>
      {children}
    </button>
  );
}
