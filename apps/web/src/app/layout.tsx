import type { Metadata } from 'next';
import { IBM_Plex_Mono, Montserrat, Plus_Jakarta_Sans } from 'next/font/google';
import { InitialLoader } from '@/components/ui/initial-loader';
import './globals.css';

const headingFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

const brandFont = Montserrat({
  subsets: ['latin'],
  variable: '--font-brand',
  weight: ['700', '800'],
});

export const metadata: Metadata = {
  title: 'School OS',
  description: 'Premium multi-tenant school operations dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${headingFont.variable} ${monoFont.variable} ${brandFont.variable}`}
      >
        <InitialLoader />
        {children}
      </body>
    </html>
  );
}
