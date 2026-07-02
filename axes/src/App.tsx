import React, { useState, useCallback } from 'react';
import { useAxesStore } from './store/useAxesStore';
import AxesBriefing from './components/axes/AxesBriefing';
import SplitScreenView from './components/axes/SplitScreenView';
import ResPlanApp from './resplan/ResPlanApp';
import { axesToResPlan, loadExternalResPlanData } from './resplan';

type AppMode = 'axes' | 'resplan';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('axes');
  const activeLayout = useAxesStore((s) => s.activeLayout);
  const currentPlanId = useAxesStore((s) => s.currentPlanId);
  const [resPlanKey, setResPlanKey] = useState(0);

  const openResPlan = useCallback(() => {
    // Translate current AXES data into ResPlan format and push it into the provider
    const translated = axesToResPlan(activeLayout);
    loadExternalResPlanData(translated);
    setResPlanKey(k => k + 1);
    setMode('resplan');
  }, [activeLayout]);

  const resPlanProjectId = currentPlanId || 'Sample Project';

  const closeResPlan = useCallback(() => {
    setMode('axes');
  }, []);

  if (mode === 'resplan') {
    return (
      <div className="w-screen h-screen bg-black overflow-hidden flex flex-col">
        <ResPlanApp key={resPlanKey} onSwitchToAxes={closeResPlan} projectId={resPlanProjectId} />
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', color: '#fff', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 9999 }}>
        <button
          onClick={openResPlan}
          style={{
            padding: '6px 14px', fontSize: 12, background: '#27272a',
            color: '#d4d4d8', border: '1px solid #3f3f46', borderRadius: 6,
            cursor: 'pointer'
          }}
        >
          Open ResPlan Editor
        </button>
      </div>
      {activeLayout ? <SplitScreenView /> : <AxesBriefing />}
    </div>
  );
};

export default App;
