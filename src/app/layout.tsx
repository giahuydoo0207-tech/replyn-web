import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Replyn — Workspace làm việc có bằng chứng",
  description:
    "Nova giúp hai bên gặp nhau. Replyn giúp hai bên tin nhau để làm việc.",
};

export const viewport: Viewport = {
  themeColor: "#070806",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
