import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "cwapa — video transcriber",
  description:
    "Paste a TikTok, YouTube, or Instagram link and get a clean, timestamped transcript.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
