'use client';

import { useEffect } from 'react';
import { warmApi } from '@/lib/warm-api';

/** Rendered in the root layout: wakes the API as soon as any page (including /login) opens. */
export function WarmUpApi() {
  useEffect(() => {
    warmApi();
  }, []);
  return null;
}
