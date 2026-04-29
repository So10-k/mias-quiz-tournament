import type { Metadata } from "next";
import "./globals.css";
import { VisitLogger } from "@/components/VisitLogger";
// import { WelcomeBackToast } from "@/components/WelcomeBackToast";

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
      <body>
        {children}
        <VisitLogger />
        {/* <WelcomeBackToast /> */}
      </body>
    </html>
  );
}
