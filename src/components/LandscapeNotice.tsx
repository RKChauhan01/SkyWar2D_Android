/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { RotateCw, Sparkles, MonitorPlay } from 'lucide-react';

export default function LandscapeNotice() {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center backdrop-blur-md">
      <div className="relative mb-6">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-75 blur animate-pulse" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 border border-slate-700">
          <RotateCw className="h-10 w-10 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
        </div>
      </div>
      <h3 className="font-sans text-xl font-bold tracking-tight text-white mb-2">
        Landscape Mode Recommended
      </h3>
      <p className="font-sans text-xs text-slate-400 max-w-xs leading-relaxed mb-6">
        For the ultimate dual-laser space battle experience, please rotate your device or widen your browser window!
      </p>
      <div className="flex items-center gap-2 rounded-lg bg-teal-950/40 px-3 py-1.5 border border-teal-500/20">
        <MonitorPlay className="h-4 w-4 text-teal-400" />
        <span className="font-mono text-[11px] font-medium text-teal-300 uppercase tracking-widest">
          Continuous Landscape Enabled
        </span>
      </div>
    </div>
  );
}
