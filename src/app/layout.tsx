"use client";

import { Inter } from "next/font/google";
import "../styles/globals.css";
import { FluentProvider, webLightTheme } from '@fluentui/react-components';

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <FluentProvider theme={webLightTheme}>
          {children}
        </FluentProvider>
      </body>
    </html>
  );
}
