import { useState, useEffect } from 'react';
import LayoutCanvas from './components/LayoutCanvas';
import ElevationCanvas from './components/ElevationCanvas';
import ThreeResPlanScene from './components/ThreeResPlanScene';
import TypesSchedulePanel from './components/TypesSchedulePanel';
import type { Scope, EditTool } from './types';
import PrintLayout from './components/PrintLayout';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import EditToolbar from './components/EditToolbar';
import { useResPlanData } from './hooks/useResPlanData';

interface ResPlanAppProps {
  onSwitchToAxes?: () => void;
  projectId?: string;
}

const ResPlanApp = ({ onSwitchToAxes, projectId }: ResPlanAppProps) => {
  const { setProjectId } = useResPlanData();
  useEffect(() => { if (projectId) setProjectId(projectId); }, [projectId, setProjectId]);
  const [scope, setScope] = useState<Scope>('architectural');
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'plan' | 'elevation' | '3d'>('plan');
  const [elevationAngle, setElevationAngle] = useState<number | null>(null);
  const [activeTool, setActiveTool] = useState<EditTool>('select');
  const [showAreaLabels, setShowAreaLabels] = useState(false);

  const [activeTypes, setActiveTypes] = useState<Record<string, string>>({
    wall: 'EXT_BRICK_200',
    door: 'D_SGL_900',
    window: 'W_SLD_1200',
    room: 'LIVING_SPACE',
    column: 'C1',
    beam: 'B1'
  });

  return (
    <div className="w-full h-full bg-black text-white font-sans overflow-hidden flex flex-col">
      <header className="p-4 pb-0 flex items-center gap-4 z-10 no-print shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            className="px-3 py-1.5 bg-zinc-800/80 text-zinc-300 text-sm rounded-lg hover:bg-zinc-700 transition border border-zinc-700"
          >
            {isLeftPanelOpen ? 'Close Info' : 'Project Info'}
          </button>
          <h1 className="text-xl font-light tracking-tight text-white/90">
            Next Res <span className="font-semibold text-blue-400">UI</span>
          </h1>
          <span className="text-zinc-600 text-xs">Structural & Architectural Editor</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex bg-zinc-800/60 rounded-lg border border-zinc-700 p-0.5">
              <button onClick={() => setViewMode('plan')} className={`px-2.5 py-1 text-xs rounded-md transition-colors ${viewMode === 'plan' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>2D</button>
              <button onClick={() => setViewMode('elevation')} className={`px-2.5 py-1 text-xs rounded-md transition-colors ${viewMode === 'elevation' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>Elev</button>
              <button onClick={() => setViewMode('3d')} className={`px-2.5 py-1 text-xs rounded-md transition-colors ${viewMode === '3d' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}>3D</button>
            </div>
            {onSwitchToAxes && (
              <button
                onClick={onSwitchToAxes}
                className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition border border-zinc-700"
              >
                Switch to AXES
              </button>
            )}
          </div>
        </div>
      </header>

      {isEditMode && <EditToolbar activeTool={activeTool} setActiveTool={setActiveTool} />}
      {isEditMode && (
        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/80 border-b border-zinc-700/30">
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
            <input type="checkbox" checked={showAreaLabels} onChange={e => setShowAreaLabels(e.target.checked)} className="accent-blue-500" />
            Area Labels
          </label>
        </div>
      )}

      <main className="flex-1 p-4 pt-0 relative min-h-0">
        <div className="w-full h-full relative z-0">
          {viewMode === 'plan' ? (
            <LayoutCanvas scope={scope} isEditMode={isEditMode} setIsEditMode={setIsEditMode} activeTypes={activeTypes} activeTool={activeTool} setActiveTool={setActiveTool} showAreaLabels={showAreaLabels} />
          ) : viewMode === '3d' ? (
            <ThreeResPlanScene />
          ) : (
            <ElevationCanvas elevationAngle={elevationAngle ?? 0} />
          )}
        </div>
      </main>

      <PrintLayout scope={scope} />

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
};

export default ResPlanApp;
