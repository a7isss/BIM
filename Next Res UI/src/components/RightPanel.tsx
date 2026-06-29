import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Download, Printer, Save, Edit3, Eye, RefreshCw, CheckCircle2 } from 'lucide-react';
import { downloadDxf } from '../utils/dxfExport';
import { useResPlanData } from '../hooks/useResPlanData';

import type { Scope } from '../types';
interface RightPanelProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    scope: Scope;
    setScope: (scope: Scope) => void;
    isEditMode: boolean;
    setIsEditMode: (mode: boolean) => void;
    openSchedule?: () => void;
    viewMode?: 'plan' | 'elevation';
    setViewMode?: (mode: 'plan' | 'elevation') => void;
    elevationAngle?: number | null;
    setElevationAngle?: (angle: number) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ 
    isOpen, setIsOpen, scope, setScope, 
    isEditMode, setIsEditMode, openSchedule,
    viewMode = 'plan', setViewMode,
    elevationAngle, setElevationAngle
}) => {
    const { nodes, elements, slabs, save, reloadResults, project_info } = useResPlanData();
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

    const handlePrint = () => {
        window.print();
    };

    const handleDxfExport = () => {
        downloadDxf(nodes, elements, slabs, 'structural_layout.dxf');
    };

    // Fallback to project_info if state not explicitly set
    const currentAngle = elevationAngle !== null && elevationAngle !== undefined ? elevationAngle : (project_info?.front_elevation_angle || 0);

    return (
        <div 
            className={`fixed top-0 right-0 h-full bg-zinc-900 border-l border-zinc-800 transition-all duration-300 z-50 flex flex-col shadow-2xl ${isOpen ? 'w-80 translate-x-0' : 'w-80 translate-x-full'}`}
        >
            {/* Toggle Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`absolute top-1/2 -left-10 w-10 h-16 bg-zinc-900 border-y border-l border-zinc-800 rounded-l-lg flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer shadow-lg`}
            >
                {isOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>

            {/* Panel Content */}
            <div className="p-6 flex-1 overflow-y-auto">
                <h2 className="text-xl font-semibold mb-6 text-white/90">Properties</h2>
                
                <div className="mb-6">
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                        View Scope
                    </label>
                    <div className="relative">
                        <select 
                            value={scope}
                            onChange={(e) => {
                                setScope(e.target.value as Scope);
                                if (e.target.value !== 'architectural' && setViewMode) {
                                    setViewMode('plan');
                                }
                            }}
                            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="architectural">Architectural</option>
                            <option value="structural">Structural</option>
                            <option value="plumbing">Plumbing</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                            ▼
                        </div>
                    </div>
                </div>

                {scope === 'architectural' && setViewMode && (
                    <div className="mb-8">
                        <div className="flex bg-zinc-800/50 rounded-lg border border-zinc-700 p-1">
                            <button
                                onClick={() => setViewMode('plan')}
                                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${viewMode === 'plan' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                            >
                                Plan View
                            </button>
                            <button
                                onClick={() => setViewMode('elevation')}
                                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${viewMode === 'elevation' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                            >
                                Elevation
                            </button>
                        </div>
                    </div>
                )}

                {viewMode === 'elevation' && setElevationAngle && (
                    <div className="mb-8 bg-zinc-800/30 p-4 rounded-lg border border-zinc-700/50">
                        <label className="block text-sm font-medium text-white mb-3">
                            Rotate Elevation
                        </label>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="col-start-2">
                                <button 
                                    onClick={() => setElevationAngle(180)}
                                    className={`w-full py-2 rounded border text-xs font-medium transition-colors ${currentAngle === 180 ? 'bg-sky-900/50 border-sky-500 text-sky-300' : 'bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-400'}`}
                                >
                                    BACK (180°)
                                </button>
                            </div>
                            <div className="col-start-1 row-start-2">
                                <button 
                                    onClick={() => setElevationAngle(270)}
                                    className={`w-full py-2 rounded border text-xs font-medium transition-colors ${currentAngle === 270 ? 'bg-sky-900/50 border-sky-500 text-sky-300' : 'bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-400'}`}
                                >
                                    LEFT (270°)
                                </button>
                            </div>
                            <div className="col-start-3 row-start-2">
                                <button 
                                    onClick={() => setElevationAngle(90)}
                                    className={`w-full py-2 rounded border text-xs font-medium transition-colors ${currentAngle === 90 ? 'bg-sky-900/50 border-sky-500 text-sky-300' : 'bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-400'}`}
                                >
                                    RIGHT (90°)
                                </button>
                            </div>
                            <div className="col-start-2 row-start-3">
                                <button 
                                    onClick={() => setElevationAngle(0)}
                                    className={`w-full py-2 rounded border text-xs font-medium transition-colors ${currentAngle === 0 ? 'bg-sky-900/50 border-sky-500 text-sky-300' : 'bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-400'}`}
                                >
                                    FRONT (0°)
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mb-8">
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                        Interaction Mode
                    </label>
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 border ${
                            isEditMode 
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-lg shadow-amber-900/20'
                                : 'bg-zinc-800/50 text-zinc-300 border-zinc-700 hover:bg-zinc-800 hover:text-white'
                        }`}
                    >
                        {isEditMode ? <Edit3 size={16} /> : <Eye size={16} />}
                        <span>{isEditMode ? 'Edit Mode Active' : 'View Only Mode'}</span>
                    </button>
                    <p className="text-xs text-zinc-500 mt-2">
                        {isEditMode ? 'Click on canvas elements to modify the layout.' : 'Switch to Edit Mode to add or remove doors, windows, and columns.'}
                    </p>
                </div>

                <div className="mb-8">
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                        Export & Print
                    </label>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handlePrint}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 bg-zinc-800/50 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                        >
                            <Printer className="w-4 h-4 text-blue-400" />
                            <span>Export PDF</span>
                        </button>
                        <button
                            onClick={handleDxfExport}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 bg-zinc-800/50 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                        >
                            <Download className="w-4 h-4 text-amber-500" />
                            <span>Export DXF</span>
                        </button>
                    </div>
                </div>

                <div className="mb-8">
                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                        Data Management
                    </label>
                    <div className="flex flex-col gap-3">
                        <button 
                            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                saveState === 'saved' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50' :
                                saveState === 'saving' ? 'bg-zinc-700/50 text-zinc-400 cursor-wait' :
                                'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                            }`}
                            onClick={async () => {
                                if (saveState !== 'idle') return;
                                setSaveState('saving');
                                await save();
                                setSaveState('saved');
                                setTimeout(() => setSaveState('idle'), 2500);
                            }}
                            disabled={saveState !== 'idle'}
                        >
                            {saveState === 'saved' ? <CheckCircle2 className="w-4 h-4" /> : <Save className={`w-4 h-4 ${saveState === 'saving' ? 'animate-pulse' : ''}`} />}
                            <span>{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving...' : 'Save Project'}</span>
                        </button>
                        
                        <button
                            onClick={async () => {
                                await reloadResults();
                                alert('Analysis results reloaded.');
                            }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 bg-zinc-800/50 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                        >
                            <RefreshCw className="w-4 h-4 text-sky-400" />
                            <span>Reload Analysis Results</span>
                        </button>

                        <button
                            onClick={openSchedule}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 bg-zinc-800/50 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 mt-2"
                        >
                            <span>Types Schedule (BIM)</span>
                        </button>
                    </div>
                </div>

                <div className="text-zinc-500 text-sm italic">
                    (More properties coming soon)
                </div>
            </div>
        </div>
    );
};

export default RightPanel;
