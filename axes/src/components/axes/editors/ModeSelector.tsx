import React from 'react';
import { useAxesStore } from '../../../store/useAxesStore';
import {
  MousePointer2,
  Move,
  DoorOpen,
  Square,
  RotateCw
} from 'lucide-react';

/**
 * Mode selector toolbar for 2D editing
 * Shows current interaction mode and allows switching
 */
export const ModeSelector: React.FC = () => {
  const {
    interactionMode,
    setInteractionMode,
    selectedStairId,
    rotateStair,
    editingMode,
  } = useAxesStore();

  if (editingMode === 'select') return null;

  const modes = [
    { id: 'select', label: 'Select (V)', icon: MousePointer2 },
    { id: 'move-node', label: 'Move Room (M)', icon: Move },
    { id: 'move-stair', label: 'Move Stair (S)', icon: Square },
    { id: 'place-door', label: 'Add Door (D)', icon: DoorOpen },
    { id: 'place-window', label: 'Add Window (W)', icon: Square },
  ] as const;

  const handleRotateStair = () => {
    if (selectedStairId) {
      rotateStair(selectedStairId);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg p-2 shadow-lg">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = interactionMode === mode.id;

        return (
          <button
            key={mode.id}
            onClick={() => setInteractionMode(mode.id)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
              transition-all duration-150
              ${isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }
            `}
            title={mode.label}
          >
            <Icon size={16} />
            <span className="hidden lg:inline">{mode.label.split('(')[0].trim()}</span>
          </button>
        );
      })}

      {/* Rotate Stair Button (only shown when stair is selected) */}
      {selectedStairId && (
        <>
          <div className="w-px h-6 bg-zinc-700 mx-2" />
          <button
            onClick={handleRotateStair}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
              text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800
              transition-all duration-150"
            title="Rotate Stair (R)"
          >
            <RotateCw size={16} />
            <span className="hidden lg:inline">Rotate</span>
          </button>
        </>
      )}
    </div>
  );
};
