import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useResPlanData } from '../hooks/useResPlanData';
import type { Level } from '../types';

interface LeftPanelProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    activeTypes: Record<string, string>;
    setActiveTypes: (types: Record<string, string>) => void;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ isOpen, setIsOpen, activeTypes, setActiveTypes }) => {
    const { project_info, levels, updateState, types } = useResPlanData();

    const handleInfoChange = (field: string, value: string) => {
        updateState({
            project_info: {
                ...project_info,
                [field]: value
            }
        });
    };

    return (
        <div 
            className={`fixed top-0 left-0 h-full bg-zinc-900 border-r border-zinc-800 transition-all duration-300 z-50 flex flex-col shadow-2xl ${isOpen ? 'w-80 translate-x-0' : 'w-80 -translate-x-full'}`}
        >
            {/* Toggle Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`absolute top-1/2 -right-10 w-10 h-16 bg-zinc-900 border-y border-r border-zinc-800 rounded-r-lg flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer shadow-lg`}
            >
                {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>

            {/* Panel Content */}
            <div className="p-6 flex-1 overflow-y-auto">
                <h2 className="text-xl font-semibold mb-6 text-white/90">Project Info</h2>
                
                {project_info ? (
                    <div className="flex flex-col gap-4">
                        <div className="bg-zinc-800/30 border border-blue-500/30 p-3 rounded-lg mb-2">
                            <h3 className="text-sm font-semibold text-blue-400 mb-3">Active Drawing Types</h3>
                            
                            <div className="flex flex-col gap-2">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Wall Type</label>
                                    <select 
                                        value={activeTypes.wall}
                                        onChange={(e) => setActiveTypes({...activeTypes, wall: e.target.value})}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 outline-none focus:border-blue-500"
                                    >
                                        {types?.walls?.map((t: any) => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Door Type</label>
                                    <select 
                                        value={activeTypes.door}
                                        onChange={(e) => setActiveTypes({...activeTypes, door: e.target.value})}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 outline-none focus:border-blue-500"
                                    >
                                        {types?.doors?.map((t: any) => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Window Type</label>
                                    <select 
                                        value={activeTypes.window}
                                        onChange={(e) => setActiveTypes({...activeTypes, window: e.target.value})}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 outline-none focus:border-blue-500"
                                    >
                                        {types?.windows?.map((t: any) => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Room Type</label>
                                    <select 
                                        value={activeTypes.room}
                                        onChange={(e) => setActiveTypes({...activeTypes, room: e.target.value})}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 outline-none focus:border-blue-500"
                                    >
                                        {types?.rooms?.map((t: any) => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <hr className="border-zinc-800 my-1" />

                        <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">Project Name</label>
                            <input 
                                type="text"
                                value={project_info.name || ''}
                                onChange={(e) => handleInfoChange('name', e.target.value)}
                                className="w-full bg-zinc-800/50 border border-zinc-700 rounded p-2 text-sm text-zinc-200 outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">Client</label>
                            <input 
                                type="text"
                                value={project_info.client || ''}
                                onChange={(e) => handleInfoChange('client', e.target.value)}
                                className="w-full bg-zinc-800/50 border border-zinc-700 rounded p-2 text-sm text-zinc-200 outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">Designer</label>
                            <input 
                                type="text"
                                value={project_info.designer || ''}
                                onChange={(e) => handleInfoChange('designer', e.target.value)}
                                className="w-full bg-zinc-800/50 border border-zinc-700 rounded p-2 text-sm text-zinc-200 outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Date</label>
                                <input 
                                    type="text"
                                    value={project_info.date || ''}
                                    onChange={(e) => handleInfoChange('date', e.target.value)}
                                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded p-2 text-sm text-zinc-200 outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Revision</label>
                                <input 
                                    type="text"
                                    value={project_info.rev || ''}
                                    onChange={(e) => handleInfoChange('rev', e.target.value)}
                                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded p-2 text-sm text-zinc-200 outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <hr className="border-zinc-800 my-4" />
                        <h3 className="text-sm font-semibold text-white/80">Land & Envelope Parameters</h3>
                        
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Land Width (m)</label>
                                <input 
                                    type="number"
                                    value={project_info.plot?.width_m || ''}
                                    onChange={(e) => handleInfoChange('plot', { ...project_info.plot, width_m: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded p-2 text-sm text-zinc-200 outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Land Depth (m)</label>
                                <input 
                                    type="number"
                                    value={project_info.plot?.depth_m || ''}
                                    onChange={(e) => handleInfoChange('plot', { ...project_info.plot, depth_m: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded p-2 text-sm text-zinc-200 outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                        
                        <label className="block text-xs font-medium text-zinc-500 mt-2">Setbacks (m)</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] text-zinc-600">Front</label>
                                <input 
                                    type="number"
                                    value={project_info.plot?.setbacks_m?.front || ''}
                                    onChange={(e) => handleInfoChange('plot', { ...project_info.plot, setbacks_m: { ...project_info.plot?.setbacks_m, front: parseFloat(e.target.value) || 0 } })}
                                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-zinc-600">Rear</label>
                                <input 
                                    type="number"
                                    value={project_info.plot?.setbacks_m?.rear || ''}
                                    onChange={(e) => handleInfoChange('plot', { ...project_info.plot, setbacks_m: { ...project_info.plot?.setbacks_m, rear: parseFloat(e.target.value) || 0 } })}
                                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-zinc-600">Side 1</label>
                                <input 
                                    type="number"
                                    value={project_info.plot?.setbacks_m?.side1 || ''}
                                    onChange={(e) => handleInfoChange('plot', { ...project_info.plot, setbacks_m: { ...project_info.plot?.setbacks_m, side1: parseFloat(e.target.value) || 0 } })}
                                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-zinc-600">Side 2</label>
                                <input 
                                    type="number"
                                    value={project_info.plot?.setbacks_m?.side2 || ''}
                                    onChange={(e) => handleInfoChange('plot', { ...project_info.plot, setbacks_m: { ...project_info.plot?.setbacks_m, side2: parseFloat(e.target.value) || 0 } })}
                                    className="w-full bg-zinc-800/50 border border-zinc-700 rounded p-1.5 text-xs text-zinc-200 outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <hr className="border-zinc-800 my-2" />
                        <h3 className="text-sm font-semibold text-white/80">Architectural Levels</h3>
                        
                        <div className="flex flex-col gap-3">
                            {levels?.architectural?.map((lvl: Level, index: number) => (
                                <div key={lvl.id} className="bg-zinc-800/30 border border-zinc-700/50 p-3 rounded-lg">
                                    <div className="font-medium text-sm text-zinc-300 mb-2">{lvl.name}</div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-xs text-zinc-500 mb-1">Elev (m)</label>
                                            <input 
                                                type="number" step="0.1"
                                                value={lvl.elevation_m}
                                                onChange={(e) => {
                                                    const newLevels = [...levels.architectural];
                                                    newLevels[index].elevation_m = parseFloat(e.target.value) || 0;
                                                    updateState({ levels: { ...levels, architectural: newLevels } });
                                                }}
                                                className="w-full bg-zinc-800 border border-zinc-600 rounded p-1.5 text-sm text-zinc-200 outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs text-zinc-500 mb-1">Height (m)</label>
                                            <input 
                                                type="number" step="0.1"
                                                value={lvl.height_m}
                                                onChange={(e) => {
                                                    const newLevels = [...levels.architectural];
                                                    newLevels[index].height_m = parseFloat(e.target.value) || 0;
                                                    updateState({ levels: { ...levels, architectural: newLevels } });
                                                }}
                                                className="w-full bg-zinc-800 border border-zinc-600 rounded p-1.5 text-sm text-zinc-200 outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-zinc-500 text-sm italic">Loading...</div>
                )}
            </div>
        </div>
    );
};

export default LeftPanel;
