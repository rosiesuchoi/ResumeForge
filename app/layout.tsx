import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Forge",
  description:
    "Turn any resume into an ATS-optimized Jake's Resume (LaTeX/Overleaf) with Google XYZ bullets, live SWE job matching, and AI coaching.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
