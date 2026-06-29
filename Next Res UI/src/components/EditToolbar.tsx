import React from 'react';
import { DoorOpen, Eraser, Square, Plus, MousePointer2, Save, RotateCw, Move } from 'lucide-react';
import { useResPlanData } from '../hooks/useResPlanData';

export type EditTool = 'select' | 'add_door' | 'remove_door' | 'add_window' | 'remove_window' | 'add_column' | 'remove_column' | 'add_beam' | 'remove_beam' | 'rotate_column' | 'move_column' | 'add_arch_wall' | 'remove_arch';

interface EditToolbarProps {
    activeTool: EditTool;
    setActiveTool: (tool: EditTool) => void;
}

const EditToolbar: React.FC<EditToolbarProps> = ({ activeTool, setActiveTool }) => {
    const { save } = useResPlanData();
    
    const ToolButton = ({ tool, icon: Icon, label }: { tool: EditTool, icon: any, label: string }) => {
        const isActive = activeTool === tool;
        const isRemove = tool.startsWith('remove');
        return (
            <button
                onClick={() => setActiveTool(tool)}
                className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 ${
                    isActive 
                        ? (isRemove ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-blue-500/20 text-blue-400 border border-blue-500/50')
                        : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50 hover:text-white border border-transparent'
                }`}
                title={label}
            >
                <Icon size={24} className="mb-1" />
                <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
            </button>
        );
    };

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 p-2 rounded-2xl shadow-2xl z-40 flex items-center gap-2 overflow-x-auto custom-scrollbar max-w-[90vw]">
            <ToolButton tool="select" icon={MousePointer2} label="Select" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="add_door" icon={DoorOpen} label="Add Door" />
            <ToolButton tool="remove_door" icon={Eraser} label="Del Door" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="add_window" icon={Square} label="Add Window" />
            <ToolButton tool="remove_window" icon={Eraser} label="Del Win" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="add_arch_wall" icon={Square} label="Add Wall" />
            <ToolButton tool="remove_arch" icon={Eraser} label="Del Wall" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="add_column" icon={Plus} label="Add Col" />
            <ToolButton tool="remove_column" icon={Eraser} label="Del Col" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="add_beam" icon={Plus} label="Add Beam" />
            <ToolButton tool="remove_beam" icon={Eraser} label="Del Beam" />
            <div className="w-px h-10 bg-zinc-800 mx-1"></div>
            <ToolButton tool="rotate_column" icon={RotateCw} label="Rot Col" />
            <ToolButton tool="move_column" icon={Move} label="Move Col" />
            
            <div className="w-px h-10 bg-zinc-800 mx-3"></div>
            
            <button
                onClick={save}
                className="flex flex-col items-center justify-center w-20 h-16 rounded-xl transition-all duration-200 bg-blue-600/20 border border-blue-500/50 text-blue-400 hover:text-white hover:bg-blue-600/40 shadow-lg shadow-blue-900/20"
                title="Save to resplan_nodes.json"
            >
                <Save size={24} className="mb-1" />
                <span className="text-[10px] font-medium text-center leading-tight">Save</span>
            </button>
        </div>
    );
};

export default EditToolbar;
