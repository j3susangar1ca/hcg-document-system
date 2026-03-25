"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const inter = Inter({ subsets: ["latin"] });

// Polyfill for Promise.withResolvers (needed by pdfjs-dist 4.4+)
if (typeof Promise.withResolvers === "undefined") {
  // @ts-expect-error polyfill
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = isDark ? webDarkTheme : webLightTheme;
  
  return (
    <html lang="es" className="antialiased">
      <body className={`${inter.className} font-sans bg-surface-base text-text-primary`}>
        <FluentProvider theme={theme}>
          <SkipLink />
          <main id="main-content" className="flex min-h-screen">
            {children}
          </main>
        </FluentProvider>
      </body>
    </html>
  );
}

// Accesibilidad: Skip Link
const SkipLink = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 
      focus:z-[9999] focus:px-4 focus:py-2 focus:bg-brand-500 focus:text-white 
      focus:rounded-lg focus:shadow-lg"
  >
    Saltar al contenido principal
  </a>
);
