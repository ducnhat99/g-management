import { siteTitle } from '@/lib/site';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold">{siteTitle}</h1>
      <p className="mt-2 text-stone-600">
        Phase 0: monorepo đã chạy. Dashboard sẽ có ở các phase sau.
      </p>
    </main>
  );
}
