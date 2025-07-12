//Layout.tsx is the main parent file

import React from "react";
import type { Metadata } from "next";
import './globals.css';

export const metadata: Metadata = {
  title: "Time Keeping",
  description: "Powered by NextJS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="Time-Keeping" >
        {children}
      </body>
    </html>
  );
}
