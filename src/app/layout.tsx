import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lattice", template: "%s · Lattice" },
  description:
    "Open knowledge, beautifully organized. A self-hosted wiki for people and teams.",
  icons: { icon: "/lattice-logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
