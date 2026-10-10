import { AppLogo } from '@/components/app-logo';
import { siteTitle } from '@/lib/site';
import { AcceptLink } from './accept-link';

/** Finishes sign-in from an email link whose tokens arrive in the URL fragment. Public. */
export default function AcceptPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-amber-50 via-white to-stone-100 px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <AppLogo className="mx-auto size-20" priority />
        <p className="mt-3 text-xl font-semibold text-stone-900">{siteTitle}</p>
        <AcceptLink />
      </div>
    </main>
  );
}
