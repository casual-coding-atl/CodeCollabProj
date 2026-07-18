/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from '../config/queryClient';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ConfirmProvider } from '@/components/common/confirm';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import '../styles/globals.css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'CodeCollabProj' },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundShell,
});

function RootComponent() {
  return (
    <RootDocument>
      <ErrorBoundary>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider delayDuration={200}>
              <ConfirmProvider>
                <Outlet />
              </ConfirmProvider>
            </TooltipProvider>
            <Toaster richColors closeButton />
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </RootDocument>
  );
}

function NotFoundShell() {
  return (
    <RootDocument>
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">error 404</p>
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <a href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Go home
        </a>
      </div>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set the theme class before first paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
