'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UsersIcon } from '@/components/icons';

/** Header link to /members; highlighted while on it. Icon only on phones. */
export function MembersLink() {
  const active = usePathname() === '/members';
  return (
    <Link
      href="/members"
      aria-current={active ? 'page' : undefined}
      aria-label="Thành viên"
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 aria-[current=page]:bg-amber-50 aria-[current=page]:text-amber-800"
    >
      <UsersIcon className="size-4" />
      <span className="hidden sm:inline">Thành viên</span>
    </Link>
  );
}
