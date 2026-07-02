import React, { useState, useEffect } from 'react';
import { ChevronLeft, Box, Save, Check, Edit2, Eye } from 'lucide-react';
import { useAxesStore } from '../../store/useAxesStore';
import { useKeyboardShortcuts } from './editors/useKeyboardShortcuts';
import { ModeSelector } from './editors/ModeSelector';
import { SavePlanModal } from './editors/SavePlanModal';
import AxesFloorPlan from './AxesFloorPlan';
import ThreeMassingLive from './ThreeMassingLive';

const SplitScreenView: React.FC = () => {
    const {
        activeLayout,
        setActiveLayout,
        isDirty,
        setIsDirty,
        editingMode,
        setEditingMode,
        currentPlanId,
        manualSave,
        saveStatus,
    } = useAxesStore();

    const [saveSuccess, setSaveSuccess] = useState(false);
    const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
    const [activeFloor, setActiveFloor] = useState<'ground' | 'first' | 'roof'>('ground');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [pendingEdit, setPendingEdit] = useState(false);

    // Enable keyboard shortcuts
    useKeyboardShortcuts();

    const handleSave = () => {
        setIsDirty(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
    };

    const handleManualSave = async () => {
        await manualSave();
        handleSave();
    };

    const handleSaveAndEdit = async (planName: string) => {
        // The manualSave function will use the plan name
        // For now, we'll just trigger save and assume it works
        await manualSave();
        setPendingEdit(false);
        setShowSaveModal(false);
        // After save, enable edit mode
        setEditingMode('move');
    };

    const handleEditToggle = () => {
        if (editingMode === 'select') {
            // Want to switch to edit mode
            if (!currentPlanId) {
                // Not saved yet, show save modal
                setShowSaveModal(true);
                setPendingEdit(true);
            } else {
                // Already saved, enable edit mode directly
                setEditingMode('move');
            }
        } else {
            // Switch back to view mode
            setEditingMode('select');
        }
    };

    if (!activeLayout) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-xl">
                <div className="text-zinc-600 font-medium italic">Select a layout to view</div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-gradient-to-br from-gray-900 to-black rounded-xl overflow-hidden shadow-2xl">
            {/* Save Plan Modal */}
            <SavePlanModal
                isOpen={showSaveModal}
                onClose={() => {
                    setShowSaveModal(false);
                    setPendingEdit(false);
                }}
                onSave={handleSaveAndEdit}
            />

            {/* Main View */}
            <div className="absolute inset-0">
                <div className="w-full h-full">
                    {viewMode === '3d' ? (
                        <ThreeMassingLive />
                    ) : (
                        <AxesFloorPlan showColors={false} activeFloor={activeFloor} />
                    )}
                </div>
            </div>

            {/* Top Bar: Plan Info & Floor Switcher */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <button
                    onClick={() => setActiveLayout(null)}
                    className="bg-black/80 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/10 text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1 group"
                    title="Back to Explorer"
                >
                    <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back
                </button>

                <div className="bg-black/80 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/10 flex items-center gap-3 shadow-lg">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white border-r border-white/10 pr-3">
                        {activeLayout.id}
                    </span>
                    <div className="text-xs text-zinc-400">
                        <span className="text-white font-medium">{Math.round(activeLayout.total_area_m2)}</span> m²
                    </div>
                </div>

                {/* Floor Switcher */}
                <div className="bg-black/80 backdrop-blur-md rounded-lg px-2 py-1.5 border border-white/10 flex items-center gap-1 shadow-lg">
                    {(['ground', 'first', 'roof'] as const).map(floor => (
                        <button
                            key={floor}
                            onClick={() => setActiveFloor(floor)}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors ${activeFloor === floor ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'
                                }`}
                        >
                            {floor === 'ground' ? 'GF' : floor === 'first' ? '1F' : 'RF'}
                        </button>
                    ))}
                </div>

                <div className="h-4 w-px bg-white/10 mx-1"></div>

                <button
                    onClick={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}
                    className={`backdrop-blur-md rounded-lg px-4 py-1.5 shadow-lg border text-[10px] uppercase tracking-widest font-bold transition-colors flex items-center gap-2 ${viewMode === '3d' ? 'bg-indigo-600/90 border-indigo-500/50 text-white' : 'bg-black/80 hover:bg-black border-white/10 text-zinc-400 hover:text-white'}`}
                    title="3D Massing View"
                >
                    <Box size={14} className={viewMode === '3d' ? "text-indigo-200" : ""} />
                    {viewMode === '3d' ? '3D Active' : '3D Massing'}
                </button>
            </div>

            {/* Editor Tools (Mode Selector) */}
            {viewMode === '2d' && editingMode !== 'select' && (
                <div className="absolute bottom-[4.5rem] left-4 z-10">
                    <ModeSelector />
                </div>
            )}

            {/* Action Bar (Save & Generate) */}
            <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">

                <div className="flex gap-2">
                    {(isDirty || saveSuccess) && (
                        <button
                            onClick={handleManualSave}
                            disabled={saveSuccess || saveStatus === 'saving'}
                            className={`backdrop-blur-md rounded-lg px-4 py-1.5 border text-xs font-medium transition-all flex items-center gap-2 ${saveSuccess
                                ? 'bg-emerald-600/90 border-emerald-500/50 text-white'
                                : saveStatus === 'saving'
                                    ? 'bg-zinc-700/90 border-zinc-600/50 text-zinc-300 cursor-wait'
                                    : 'bg-indigo-600/90 hover:bg-indigo-600 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/20'
                                }`}
                            title="Save Your Design Version"
                        >
                            {saveStatus === 'saving' ? (
                                <Loader2 size={14} className="animate-spin text-zinc-400" />
                            ) : saveSuccess ? (
                                <Check size={14} className="text-emerald-200" />
                            ) : (
                                <Save size={14} className="text-indigo-200" />
                            )}
                            {saveSuccess ? 'Saved!' : saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}

                </div>
            </div>

            {/* View/Edit Mode Toggle (only in 2D mode) */}
            {viewMode === '2d' && (
                <div className="absolute bottom-4 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-1 border border-white/10 flex items-center gap-2">
                    {/* Mode indicator */}
                    <div className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${editingMode === 'select'
                        ? 'bg-blue-600/90 text-white shadow-lg'
                        : 'text-zinc-500'
                        }`}>
                        <Eye size={12} className="inline mr-1.5" />
                        View
                    </div>

                    <button
                        onClick={handleEditToggle}
                        className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 ${editingMode !== 'select'
                            ? 'bg-orange-600/90 text-white shadow-lg'
                            : 'text-zinc-500 hover:text-white bg-zinc-800/50'
                            }`}
                        title={editingMode === 'select' ? "Enable editing (requires save first)" : "Disable editing"}
                    >
                        <Edit2 size={12} />
                        {editingMode === 'select' ? 'Edit' : 'Editing'}
                    </button>
                </div>
            )}
        </div >
    );
};

export default SplitScreenView;
