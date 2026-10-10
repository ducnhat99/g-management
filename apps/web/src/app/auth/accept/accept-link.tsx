'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AlertIcon } from '@/components/icons';
import { afterEmailLink, emailLinkProblem, parseAuthFragment } from '@/lib/auth-fragment';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/** Reads the `#access_token=…` Supabase sent, stores the session, then continues. */
export function AcceptLink() {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  // The fragment can be read only once (it is cleared below), so never run this twice, even if
  // the effect re-runs (React Strict Mode, a new router object).
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const fragment = parseAuthFragment(window.location.hash);
    // Drop the tokens from the address bar and history straight away.
    window.history.replaceState(null, '', window.location.pathname);

    if (fragment.kind === 'session') {
      getSupabaseBrowserClient()
        .auth.setSession({
          access_token: fragment.accessToken,
          refresh_token: fragment.refreshToken,
        })
        .then(({ error }) => {
          if (error) {
            setProblem(emailLinkProblem(null));
            return;
          }
          router.replace(afterEmailLink(fragment.type));
          router.refresh();
        });
      return;
    }
    // Deferred so the state update happens outside the effect body.
    const message = emailLinkProblem(fragment.kind === 'error' ? fragment.code : null);
    queueMicrotask(() => setProblem(message));
  }, [router]);

  if (!problem) {
    return (
      <p role="status" className="mt-8 flex items-center justify-center gap-2 text-stone-600">
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"
        />
        Đang xác nhận lời mời…
      </p>
    );
  }
  return (
    <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 text-left shadow-xl shadow-amber-900/5">
      <p role="alert" className="flex items-start gap-2 text-stone-800">
        <AlertIcon className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <span>
          {problem} Nhờ người mời mở mục <strong>Thành viên</strong> và bấm{' '}
          <strong>“Gửi lại”</strong> để nhận liên kết mới.
        </span>
      </p>
      <Link
        href="/login"
        className="mt-5 flex h-11 items-center justify-center rounded-lg border border-stone-300 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
      >
        Về trang đăng nhập
      </Link>
    </div>
  );
}
