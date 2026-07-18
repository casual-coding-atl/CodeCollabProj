import { memo, type FC, type ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
}

const Layout: FC<LayoutProps> = memo(({ children }) => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      {/* pb-24 on mobile reserves space for the fixed bottom tab bar (see Header) */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-8 sm:px-6 sm:py-8">{children}</main>
      <Footer />
    </div>
  );
});

Layout.displayName = 'Layout';

export default Layout;
