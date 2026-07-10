import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Orca Strike",
  robots: { index: false, follow: false },
};

export default function OrcaStrikeGameLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        overflow: "hidden",
        background: "#061018",
      }}
    >
      {children}
    </div>
  );
}
