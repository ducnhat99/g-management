import { AppLogo } from '@/components/app-logo';
import { siteTitle } from '@/lib/site';
import { safeNextPath } from '@/lib/safe-next-path';
import { LoginForm } from './login-form';

const HIGHLIGHTS = [
  { title: 'Giá Ngọc Thịnh', text: 'Nhẫn trơn 9999, tự cập nhật khi bạn mở app' },
  { title: 'Lời/lỗ thật', text: 'Tính theo giá tiệm mua vào, đúng số tiền bạn nhận lại' },
  { title: 'Từng lần mua', text: 'Giá vốn, số ngày nắm giữ và lời/lỗ của mỗi giao dịch' },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="min-h-screen bg-linear-to-br from-amber-50 via-white to-stone-100 lg:grid lg:grid-cols-2">
      {/* Brand panel: desktop widths (lg) and up; phones get the compact logo above the form. */}
      <section className="relative hidden overflow-hidden bg-linear-to-br from-amber-700 via-amber-600 to-yellow-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 size-96 rounded-full border-48 border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -left-16 size-80 rounded-full border-40 border-white/10"
        />

        <div className="relative flex items-center gap-3">
          <AppLogo className="size-12 ring-white/40" priority />
          <span className="text-xl font-semibold">{siteTitle}</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-bold">
            Biết ngay vàng của bạn đang lời hay lỗ.
          </h2>
          <ul className="mt-8 space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm"
                >
                  ✓
                </span>
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="text-amber-50/90">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-amber-50/80">
          Giá tham khảo từ ngocthinh-jewelry.vn. Giá giao dịch thực tế theo bảng giá tại cửa hàng.
        </p>
      </section>

      {/* Form. */}
      <section className="flex min-h-screen items-center justify-center px-4 py-12 lg:min-h-0">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <AppLogo className="size-20" priority />
            <p className="mt-3 text-xl font-semibold text-stone-900">{siteTitle}</p>
          </div>

          <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xl shadow-amber-900/5 sm:p-8">
            <h1 className="text-2xl font-semibold text-stone-900">Đăng nhập</h1>
            <p className="mt-1 text-sm text-stone-600">
              Chào mừng trở lại! Đăng nhập để xem danh mục vàng của bạn.
            </p>
            <LoginForm next={safeNextPath(typeof next === 'string' ? next : null)} />
          </div>

          <p className="mt-6 text-center text-xs text-stone-500">
            Tài khoản do quản trị viên tạo. Liên hệ nếu bạn cần truy cập.
          </p>
        </div>
      </section>
    </main>
  );
}
