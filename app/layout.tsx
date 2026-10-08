import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ConvexAuthNextjsServerProvider } from '@convex-dev/auth/nextjs/server';
import ConvexClientProvider from '@/components/ConvexClientProvider';
import { isConvexConfigured } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  title: 'Margin',
  description: 'A thinking canvas with an assistant that reads, reflects and finds, and leaves the ideas to you.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const body = isConvexConfigured() ? (
    <ConvexAuthNextjsServerProvider>
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </ConvexAuthNextjsServerProvider>
  ) : (
    children
  );

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{body}</body>
    </html>
  );
}
