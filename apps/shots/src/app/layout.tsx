import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shots",
  description: "Small offer tests.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
