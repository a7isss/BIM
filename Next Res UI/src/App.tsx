import { useState } from 'react';
import LayoutCanvas from './components/LayoutCanvas';
import ElevationCanvas from './components/ElevationCanvas';
import TypesSchedulePanel from './components/TypesSchedulePanel';
import type { Scope } from './components/RightPanel';
import PrintLayout from './components/PrintLayout';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';

function App() {
  const [scope, setScope] = useState<Scope>('architectural');
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'plan' | 'elevation'>('plan');
  const [elevationAngle, setElevationAngle] = useState<number | null>(null);
  
  const [activeTypes, setActiveTypes] = useState({
      wall: 'EXT_BRICK_200',
      door: 'D_SGL_900',
      window: 'W_SLD_1200',
      room: 'LIVING_SPACE',
      column: 'C1',
      beam: 'B1'
  });

  return (
    <div className="w-full min-h-screen bg-black text-white font-sans overflow-hidden">
      <header className="p-6 pb-0 flex flex-col gap-2 relative z-10 no-print">
        <h1 className="text-3xl font-light tracking-tight text-white/90">
          Next Res <span className="font-semibold text-blue-400">UI</span>
        </h1>
        <p className="text-zinc-500 text-sm">Standalone Structural & Architectural Visualizer</p>
      </header>
      
      <main className="p-6 h-[calc(100vh-100px)] relative no-print">
        <div className="w-full h-full relative z-0">
            {viewMode === 'plan' ? (
                <LayoutCanvas scope={scope} isEditMode={isEditMode} setIsEditMode={setIsEditMode} activeTypes={activeTypes} />
            ) : (
                <ElevationCanvas elevationAngle={elevationAngle ?? 0} />
            )}
        </div>
      </main>

      <PrintLayout scope={scope} />

      {/* Side Panels */}
      <div className="print:hidden">
        <LeftPanel isOpen={isLeftPanelOpen} setIsOpen={setIsLeftPanelOpen} activeTypes={activeTypes} setActiveTypes={setActiveTypes} />
        <RightPanel 
            isOpen={isRightPanelOpen} 
            setIsOpen={setIsRightPanelOpen} 
            scope={scope}
            setScope={setScope}
            isEditMode={isEditMode}
            setIsEditMode={setIsEditMode}
            openSchedule={() => setIsScheduleOpen(true)}
            viewMode={viewMode}
            setViewMode={setViewMode}
            elevationAngle={elevationAngle}
            setElevationAngle={setElevationAngle}
        />

        <TypesSchedulePanel 
            isOpen={isScheduleOpen}
            setIsOpen={setIsScheduleOpen}
        />
      </div>
    </div>
  );
}

export default App;
