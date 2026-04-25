import { type ButtonHTMLAttributes, type AnchorHTMLAttributes } from "react";
import Link from "next/link";

type CommonProps = {
  variant?: "primary" | "ghost" | "danger";
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & CommonProps;
type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> &
  CommonProps & { href: string };

const baseClasses =
  "inline-flex items-center gap-2 px-4 py-2 font-reading text-body border border-ink bg-paper text-ink rounded-sm " +
  "hover:bg-ink hover:text-paper transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-paper disabled:hover:text-ink";

const variantClasses: Record<NonNullable<CommonProps["variant"]>, string> = {
  primary: "",
  ghost: "border-transparent hover:underline hover:bg-paper hover:text-ink",
  danger: "border-accent-red text-accent-red hover:bg-accent-red hover:text-paper",
};

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  href,
  ...rest
}: LinkProps) {
  return (
    <Link
      href={href}
      {...rest}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    />
  );
}
