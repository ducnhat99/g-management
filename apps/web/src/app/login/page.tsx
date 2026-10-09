import { siteTitle } from '@/lib/site';
import { safeNextPath } from '@/lib/safe-next-path';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold">{siteTitle}</h1>
      <p className="mt-1 text-sm text-stone-600">Đăng nhập để xem lời/lỗ vàng của bạn.</p>
      <LoginForm next={safeNextPath(typeof next === 'string' ? next : null)} />
    </main>
  );
}
