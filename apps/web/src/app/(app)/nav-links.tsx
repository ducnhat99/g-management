import { TrendIcon, UsersIcon } from '@/components/icons';
import { NavLink } from './nav-link';

export function StatisticsLink() {
  return (
    <NavLink href="/statistics" label="Thống kê giá" icon={<TrendIcon className="size-4" />} />
  );
}

export function MembersLink() {
  return <NavLink href="/members" label="Thành viên" icon={<UsersIcon className="size-4" />} />;
}
