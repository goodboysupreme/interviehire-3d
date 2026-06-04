'use client';

import { useEffect } from 'react';
import { initDashboardPage } from '../../src/dashboard';
import { html } from '../../src/html/dashboard-glass';

export default function DashboardGlassPage() {
  useEffect(() => {
    const cleanup = initDashboardPage();
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
