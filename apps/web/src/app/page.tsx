import { redirect } from 'next/navigation';
import { DEFAULT_AFTER_LOGIN } from '@/lib/safe-next-path';

export default function HomePage() {
  redirect(DEFAULT_AFTER_LOGIN);
}
