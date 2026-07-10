import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orca Strike",
  description: "Standalone arcade orca game over Salish Sea bathymetry.",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
