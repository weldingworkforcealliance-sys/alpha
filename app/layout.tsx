'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './styles.css';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const hideWorkspaceNav =
    pathname === '/login' ||
    pathname === '/account-setup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password';

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Living Teacher Planner</title>
      </head>
      <body>
        <div className="app-container">
          {!hideWorkspaceNav && (
            <nav
              aria-label="Planner workspace navigation"
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: '10px 16px',
                borderBottom: '1px solid #242424',
                background: '#0d0d0d',
              }}
            >
              <Link
                href="/dashboard"
                style={{
                  color: pathname === '/dashboard' ? '#00ff88' : '#c8c8c8',
                  textDecoration: 'none',
                  fontWeight: 800,
                  fontSize: '13px',
                }}
              >
                Planner
              </Link>
              <Link
                href="/agenda"
                style={{
                  color: pathname === '/agenda' ? '#00ff88' : '#c8c8c8',
                  textDecoration: 'none',
                  fontWeight: 800,
                  fontSize: '13px',
                }}
              >
                Agenda Workspace
              </Link>
            </nav>
          )}
          {children}
        </div>
      </body>
    </html>
  );
}
