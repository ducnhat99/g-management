'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Header link, highlighted while on its page. Icon only on phones. */
export function NavLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 aria-[current=page]:bg-amber-50 aria-[current=page]:text-amber-800"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
