'use client';

import { useEffect, useState } from 'react';

export function Preloader() {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Keep preloader short and smooth.
  useEffect(() => {
    const TOTAL_DURATION = 1300;
    const UPDATE_INTERVAL = 16;
    const startTime = Date.now();

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min((elapsed / TOTAL_DURATION) * 100, 100);
      setProgress(currentProgress);

      if (currentProgress >= 100) {
        clearInterval(progressInterval);
        setProgress(100);
        setTimeout(() => setIsComplete(true), 120);
      }
    }, UPDATE_INTERVAL);

    return () => clearInterval(progressInterval);
  }, []);

  if (isComplete) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-background/95 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 w-64">
        <div className="h-12 w-12 rounded-full border-2 border-border border-t-foreground animate-spin" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Work Report</h2>
          <p className="text-xs text-muted-foreground">Loading workspace...</p>
        </div>
        <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-foreground transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
