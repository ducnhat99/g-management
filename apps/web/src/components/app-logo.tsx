import Image from 'next/image';

/**
 * The G-management emblem (gold "G", bars and arrow) as a rounded tile. The image lives in
 * public/logo-mark.png (256×256, cropped from the full logo artwork). Decorative: the app name is
 * always written next to it, so alt is empty.
 */
export function AppLogo({
  className = 'size-12',
  priority = false,
}: {
  className?: string;
  /** Preload: for the logo visible on first paint (header, login). */
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      width={256}
      height={256}
      priority={priority}
      className={`shrink-0 rounded-[22%] object-cover shadow-sm ring-1 ring-amber-900/10 ${className}`}
    />
  );
}
