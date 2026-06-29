import React, { useState } from 'react';
import { DoorOpen, Eraser, Square, Plus, MousePointer2, Save, RotateCw, Move, Armchair, CheckCircle2, Scissors, GripHorizontal, Trash2 } from 'lucide-react';
import { useResPlanData } from '../hooks/useResPlanData';
import type { EditTool } from '../types';

interface EditToolbarProps {
    activeTool: EditTool;
    setActiveTool: (tool: EditTool) => void;
}

const EditToolbar: React.FC<EditToolbarProps> = ({ activeTool, setActiveTool }) => {
    const { save, saveTouchups } = useResPlanData();
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

    const handleSave = async () => {
        if (saveState !== 'idle') return;
        setSaveState('saving');
        await save();
        if (saveTouchups) await saveTouchups();
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2500);
    };
    
    const ToolButton = ({ tool, icon: Icon, label }: { tool: EditTool, icon: any, label: string }) => {
        const isActive = activeTool === tool;
        const isRemove = tool.startsWith('remove');
        const isAdd = tool.startsWith('add');
        
        let activeColors = 'bg-blue-500/20 text-blue-400 border border-blue-500/50';
        let inactiveHover = 'hover:bg-blue-500/10 hover:text-blue-300';
        if (isRemove) {
            activeColors = 'bg-red-500/20 text-red-400 border border-red-500/50';
            inactiveHover = 'hover:bg-red-500/10 hover:text-red-300 text-red-400/70';
        } else if (isAdd) {
            activeColors = 'bg-green-500/20 text-green-400 border border-green-500/50';
            inactiveHover = 'hover:bg-green-500/10 hover:text-green-300 text-green-400/70';
        }

        return (
            <button
                onClick={() => setActiveTool(tool)}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 ${
                    isActive 
                        ? activeColors
                        : `bg-zinc-800/50 ${isAdd || isRemove ? '' : 'text-zinc-400 hover:text-white'} ${inactiveHover} border border-transparent`
                }`}
                title={label}
            >
                <Icon size={24} className="mb-1" />
                <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
            </button>
        );
    };

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 p-2 py-3 rounded-2xl shadow-2xl z-40 flex items-center gap-2 overflow-x-auto no-scrollbar w-max max-w-[95vw] scale-[0.75] md:scale-[0.85] lg:scale-100 origin-bottom">
            <ToolButton tool="select" icon={MousePointer2} label="Select" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="add_door" icon={DoorOpen} label="Add Door" />
            <ToolButton tool="remove_door" icon={Eraser} label="Del Door" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="add_window" icon={Square} label="Add Window" />
            <ToolButton tool="remove_window" icon={Eraser} label="Del Win" />
            <ToolButton tool="rotate_opening" icon={RotateCw} label="Rot Open" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="add_arch_wall" icon={Plus} label="Draw Wall" />
            <ToolButton tool="split_wall" icon={Scissors} label="Split Wall" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="move_node" icon={GripHorizontal} label="Move Node" />
            <ToolButton tool="remove_node" icon={Trash2} label="Del Node" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="remove_arch" icon={Eraser} label="Del Wall" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="add_room" icon={Square} label="Add Room" />
            <ToolButton tool="remove_room" icon={Eraser} label="Del Room" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="add_column" icon={Plus} label="Add Col" />
            <ToolButton tool="remove_column" icon={Eraser} label="Del Col" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="add_beam" icon={Plus} label="Add Beam" />
            <ToolButton tool="remove_beam" icon={Eraser} label="Del Beam" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="rotate_column" icon={RotateCw} label="Rot Col" />
            <ToolButton tool="move_element" icon={Move} label="Move Elm" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="add_touchup" icon={Armchair} label="Touch Up" />
            <ToolButton tool="remove_touchup" icon={Eraser} label="Del T-Up" />
            
            <div className="w-px h-10 bg-zinc-800 mx-3"></div>
            
            <button
                onClick={handleSave}
                disabled={saveState !== 'idle'}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-20 h-16 rounded-xl transition-all duration-300 shadow-lg border ${
                    saveState === 'saved' ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400 shadow-emerald-900/20' :
                    saveState === 'saving' ? 'bg-blue-800/40 border-blue-600/50 text-blue-300 opacity-70 cursor-wait shadow-blue-900/20' :
                    'bg-blue-600/20 border-blue-500/50 text-blue-400 hover:text-white hover:bg-blue-600/40 shadow-blue-900/20'
                }`}
                title="Save to JSONs"
            >
                {saveState === 'saved' ? <CheckCircle2 size={24} className="mb-1" /> : <Save size={24} className={`mb-1 ${saveState === 'saving' ? 'animate-pulse' : ''}`} />}
                <span className="text-[10px] font-medium text-center leading-tight">
                    {saveState === 'saved' ? 'Saved!' : saveState === 'saving' ? 'Saving...' : 'Save'}
                </span>
            </button>

            {/* Premium Toast Notification */}
            <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-full bg-zinc-900/90 backdrop-blur-md border border-emerald-500/30 text-emerald-400 shadow-2xl shadow-emerald-900/20 transition-all duration-500 ${
                saveState === 'saved' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
            }`}>
                <CheckCircle2 size={20} className="text-emerald-500" />
                <span className="font-medium text-sm tracking-wide">Project Saved Successfully</span>
            </div>
        </div>
    );
};

export default EditToolbar;
