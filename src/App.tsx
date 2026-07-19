/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import GameCanvas from './components/GameCanvas';

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <GameCanvas />
    </main>
  );
}
