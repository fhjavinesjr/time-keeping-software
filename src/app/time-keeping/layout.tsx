//Layout.tsx is the main parent file

import type { Metadata } from "next";
import './globals.css';
import React from "react";
import LayoutClientWrapper from "./layoutClientWrapper";
import PageAuthentication from "./PageAuthentication";

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
        
        <PageAuthentication>
          <LayoutClientWrapper>
            {children}
          </LayoutClientWrapper>
        </PageAuthentication>
        
      </body>
    </html>
  );
}
