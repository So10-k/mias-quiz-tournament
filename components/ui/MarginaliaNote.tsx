import { type ReactNode } from "react";

type Props = {
  children: ReactNode;
  tone?: "ink" | "red";
  className?: string;
};

export function MarginaliaNote({
  children,
  tone = "ink",
  className = "",
}: Props) {
  return (
    <p
      className={
        "font-hand text-caption-md " +
        (tone === "red" ? "text-accent-red " : "text-ink-muted ") +
        className
      }
    >
      {children}
    </p>
  );
}
