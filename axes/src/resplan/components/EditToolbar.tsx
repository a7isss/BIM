import React, { useState } from 'react';
import { MousePointer2, Move, Trash2, Copy, RotateCw, Plus, Scissors, DoorOpen, Square, Armchair, Type, Ruler, Save, CheckCircle2, Undo2, Redo2 } from 'lucide-react';
import { useResPlanData } from '../hooks/useResPlanData';
import type { EditTool } from '../types';

interface EditToolbarProps {
    activeTool: EditTool;
    setActiveTool: (tool: EditTool) => void;
}

interface ShortcutMap {
    [key: string]: string;
}

const TOOL_SHORTCUTS: Record<EditTool, string> = {
    select: 'V', move: 'M', delete: 'Del', copy: 'C', rotate: 'R',
    add_arch_wall: 'W', split_wall: 'S', add_door: 'D', add_window: 'N',
    add_column: 'J', add_beam: 'B', add_footing: 'F', add_room: 'O', add_touchup: 'T',
    add_text: 'X', add_dimension: 'Z',
};

const EditToolbar: React.FC<EditToolbarProps> = ({ activeTool, setActiveTool }) => {
    const { save, saveTouchups, undo, redo, canUndo, canRedo } = useResPlanData();
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

    React.useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
            if (e.ctrlKey || e.metaKey) return;
            const shortcutMap: ShortcutMap = {
                v: 'select', m: 'move', c: 'copy', r: 'rotate',
                w: 'add_arch_wall', s: 'split_wall', d: 'add_door', n: 'add_window',
                j: 'add_column', b: 'add_beam', f: 'add_footing', o: 'add_room', t: 'add_touchup',
                x: 'add_text', z: 'add_dimension',
            };
            const tool = shortcutMap[e.key.toLowerCase()] as EditTool | undefined;
            if (tool) { e.preventDefault(); setActiveTool(tool); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [setActiveTool]);

    const handleSave = async () => {
        if (saveState !== 'idle') return;
        setSaveState('saving');
        await save();
        if (saveTouchups) await saveTouchups();
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2500);
    };

    const ToolButton = ({ tool, icon: Icon, label }: { tool: EditTool; icon: any; label: string }) => {
        const isActive = activeTool === tool;
        const isGeneric = ['select', 'move', 'delete', 'copy'].includes(tool);
        const isCreate = tool.startsWith('add_') || tool === 'split_wall';
        const isRotate = tool === 'rotate';

        let activeColors = 'bg-zinc-700 text-white border-zinc-500';
        if (isGeneric) {
            activeColors = 'bg-blue-500/20 text-blue-400 border-blue-500/50';
        } else if (isCreate) {
            activeColors = 'bg-green-500/20 text-green-400 border-green-500/50';
        } else if (isRotate) {
            activeColors = 'bg-amber-500/20 text-amber-400 border-amber-500/50';
        }

        const shortcut = TOOL_SHORTCUTS[tool];

        return (
            <button
                onClick={() => setActiveTool(tool)}
                className={`relative flex-shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-all duration-150 border group ${
                    isActive
                        ? activeColors
                        : 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700/50 border-transparent'
                }`}
                title={`${label} [${shortcut}]`}
            >
                <Icon size={16} />
                <span className="absolute -top-1 -right-1 text-[9px] font-mono px-1 rounded bg-zinc-900 text-zinc-500 border border-zinc-700 leading-none opacity-0 group-hover:opacity-100 transition-opacity">
                    {shortcut}
                </span>
            </button>
        );
    };

    return (
        <div className="sticky top-0 z-40 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-700/50">
            <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar">
                {/* Undo/Redo */}
                <button
                    onClick={undo}
                    disabled={!canUndo}
                    className={`flex-shrink-0 flex items-center justify-center w-8 h-10 rounded-lg transition-all duration-150 border ${
                        canUndo ? 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700/50' : 'bg-zinc-900/30 text-zinc-700 border-transparent cursor-not-allowed'
                    }`}
                    title="Undo [Ctrl+Z]"
                >
                    <Undo2 size={14} />
                </button>
                <button
                    onClick={redo}
                    disabled={!canRedo}
                    className={`flex-shrink-0 flex items-center justify-center w-8 h-10 rounded-lg transition-all duration-150 border ${
                        canRedo ? 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700/50' : 'bg-zinc-900/30 text-zinc-700 border-transparent cursor-not-allowed'
                    }`}
                    title="Redo [Ctrl+Y]"
                >
                    <Redo2 size={14} />
                </button>
                <div className="w-px h-7 bg-zinc-700 mx-1.5 shrink-0"></div>

                {/* Generic tools */}
                <ToolButton tool="select" icon={MousePointer2} label="Select" />
                <ToolButton tool="move" icon={Move} label="Move" />
                <ToolButton tool="delete" icon={Trash2} label="Delete" />
                <ToolButton tool="copy" icon={Copy} label="Copy" />
                <ToolButton tool="rotate" icon={RotateCw} label="Rotate" />
                <div className="w-px h-7 bg-zinc-700 mx-1.5 shrink-0"></div>

                {/* Creation tools */}
                <ToolButton tool="add_arch_wall" icon={Plus} label="Draw Wall" />
                <ToolButton tool="split_wall" icon={Scissors} label="Split Wall" />
                <div className="w-px h-7 bg-zinc-700 mx-1.5 shrink-0"></div>
                <ToolButton tool="add_door" icon={DoorOpen} label="Add Door" />
                <ToolButton tool="add_window" icon={Square} label="Add Window" />
                <div className="w-px h-7 bg-zinc-700 mx-1.5 shrink-0"></div>
                <ToolButton tool="add_column" icon={Plus} label="Add Col" />
                <ToolButton tool="add_beam" icon={Plus} label="Add Beam" />
                <ToolButton tool="add_footing" icon={Square} label="Footing" />
                <div className="w-px h-7 bg-zinc-700 mx-1.5 shrink-0"></div>
                <ToolButton tool="add_room" icon={Square} label="Add Room" />
                <ToolButton tool="add_touchup" icon={Armchair} label="Touch Up" />
                <div className="w-px h-7 bg-zinc-700 mx-1.5 shrink-0"></div>
                <ToolButton tool="add_text" icon={Type} label="Text" />
                <ToolButton tool="add_dimension" icon={Ruler} label="Dimension" />

                <div className="ml-auto flex items-center gap-1.5">
                    <button
                        onClick={handleSave}
                        disabled={saveState !== 'idle'}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-lg transition-all duration-300 border text-xs font-medium ${
                            saveState === 'saved' ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400' :
                            saveState === 'saving' ? 'bg-blue-800/40 border-blue-600/50 text-blue-300 opacity-70 cursor-wait' :
                            'bg-blue-600/20 border-blue-500/50 text-blue-400 hover:text-white hover:bg-blue-600/40'
                        }`}
                        title="Save to JSONs"
                    >
                        {saveState === 'saved' ? <CheckCircle2 size={14} /> : <Save size={14} className={saveState === 'saving' ? 'animate-pulse' : ''} />}
                        <span>{saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving' : 'Save'}</span>
                    </button>
                </div>
            </div>

            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-full bg-zinc-900/90 backdrop-blur-md border border-emerald-500/30 text-emerald-400 shadow-2xl shadow-emerald-900/20 transition-all duration-500 ${
                saveState === 'saved' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
            }`}>
                <CheckCircle2 size={20} className="text-emerald-500" />
                <span className="font-medium text-sm tracking-wide">Project Saved Successfully</span>
            </div>
        </div>
    );
};

export default EditToolbar;
