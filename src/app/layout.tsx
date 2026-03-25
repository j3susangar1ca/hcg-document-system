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
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-blue-600">
          Saltar al contenido principal
        </a>
        <FluentProvider theme={webLightTheme}>
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
        </FluentProvider>
      </body>
    </html>
  );
}
