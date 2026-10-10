import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { siteTitle } from '@/lib/site';
import { Providers } from './providers';
import { WarmUpApi } from './warm-up-api';
import './globals.css';

export const metadata: Metadata = {
  title: siteTitle,
  description: 'Theo dõi lời/lỗ nhẫn trơn 9999 theo giá Ngọc Thịnh',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <WarmUpApi />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
