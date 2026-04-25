import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mia's Quiz Tournament",
  description: "Quizzes! Friends! Adventure!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
