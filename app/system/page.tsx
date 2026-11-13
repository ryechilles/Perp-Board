import type { Metadata } from 'next';
import { Showcase } from '@/components/system/Showcase';

export const metadata: Metadata = {
  title: 'Perp Board — UI system',
  description: 'Every token and component of the Perp Board UI system, rendered live.',
  robots: { index: false },
};

/** The living reference for DESIGN.md: what the system actually renders, in both themes. */
export default function SystemPage() {
  return <Showcase />;
}
