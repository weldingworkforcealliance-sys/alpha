'use client';

import type { ReactNode } from 'react';
import './styles.css';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Living Teacher Planner</title>
      </head>
      <body>
        <div className="app-container">{children}</div>
      </body>
    </html>
  );
}
