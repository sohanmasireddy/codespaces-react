import { lazy, Suspense } from 'react';

const StreamdownContent = lazy(() => import('./StreamdownContent'));

export default function MessageContent({ children, isAnimating = false }) {
  return (
    <Suspense fallback={<div className="markdown-loading" aria-label="Rendering response" />}>
      <StreamdownContent isAnimating={isAnimating}>{children}</StreamdownContent>
    </Suspense>
  );
}
