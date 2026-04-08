import { useState, useEffect } from 'react';
import { useAgentPolling } from './hooks/useAgentPolling';
import { OfficeFloorPlan } from './components/OfficeFloorPlan';
import { HudPanel } from './components/HudPanel';

export default function App() {
  const agents = useAgentPolling();
  const [tick, setTick] = useState(0);

  // Increment tick counter every second for the HUD display
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="sim-root">
      {/* Title bar */}
      <header className="sim-header">
        <span className="sim-header__logo">▣ CEO.SIM</span>
        <span className="sim-header__sub">OFFICE AGENTS v0.1.0 — LIVE SIMULATION</span>
        <span className="sim-header__time">
          {new Date().toLocaleTimeString('en-US', { hour12: false })}
        </span>
      </header>

      {/* Main viewport */}
      <main className="sim-main">
        <OfficeFloorPlan agents={agents} />
        <HudPanel agents={agents} tick={tick} />
      </main>
    </div>
  );
}
