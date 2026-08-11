import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leadgen Client",
  description: "Автономная клиентская панель лидогенерации",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
