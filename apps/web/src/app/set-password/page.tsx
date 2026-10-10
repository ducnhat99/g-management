import { redirect } from 'next/navigation';
import { AppLogo } from '@/components/app-logo';
import { siteTitle } from '@/lib/site';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SetPasswordForm } from './set-password-form';

/** Reached from an invite email (via /auth/confirm, which signed the person in). */
export default async function SetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect('/login');
  }
  const email = typeof data.claims.email === 'string' ? data.claims.email : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-amber-50 via-white to-stone-100 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <AppLogo className="size-20" priority />
          <p className="mt-3 text-xl font-semibold text-stone-900">{siteTitle}</p>
        </div>
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xl shadow-amber-900/5 sm:p-8">
          <h1 className="text-2xl font-semibold text-stone-900">Đặt mật khẩu</h1>
          <p className="mt-1 text-sm text-stone-600">
            Chào mừng bạn đến với danh mục vàng của gia đình! Đặt mật khẩu để đăng nhập lần sau
            {email ? (
              <>
                {' '}
                bằng <strong className="font-medium text-stone-800">{email}</strong>
              </>
            ) : null}
            .
          </p>
          <SetPasswordForm />
        </div>
      </div>
    </main>
  );
}
