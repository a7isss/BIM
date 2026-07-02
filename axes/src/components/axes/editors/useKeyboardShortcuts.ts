import { useEffect } from 'react';
import { useAxesStore } from '../../../store/useAxesStore';

/**
 * Global keyboard shortcuts handler for Axes 2D editor
 * Listens for key presses and triggers appropriate actions
 */
export const useKeyboardShortcuts = () => {
  const {
    interactionMode,
    selectedNodeId,
    selectedDoorId,
    selectedWindowId,
    selectedStairId,
    shortcutsEnabled,
    setInteractionMode,
    setSelectedNodeId,
    setSelectedDoorId,
    setSelectedWindowId,
    setSelectedStairId,
    rotateStair,
    removeDoor,
    removeWindow,
    manualSave,
    setShortcutsEnabled,
  } = useAxesStore();

  useEffect(() => {
    if (!shortcutsEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Mode switching shortcuts
      switch (e.key.toLowerCase()) {
        case 'v':
          e.preventDefault();
          setInteractionMode('select');
          break;
        
        case 'm':
          e.preventDefault();
          setInteractionMode('move-node');
          break;
        
        case 's':
          // Don't trigger if Ctrl+S (save) is pressed
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setInteractionMode('move-stair');
          }
          break;
        
        case 'd':
          e.preventDefault();
          setInteractionMode('place-door');
          break;
        
        case 'w':
          e.preventDefault();
          setInteractionMode('place-window');
          break;
        
        case 'r':
          // Rotate selected stair
          if (selectedStairId) {
            e.preventDefault();
            rotateStair(selectedStairId);
          }
          break;
        
        case 'delete':
        case 'backspace':
          // Delete selected door or window
          if (selectedDoorId) {
            e.preventDefault();
            removeDoor(selectedDoorId);
            setSelectedDoorId(null);
          } else if (selectedWindowId) {
            e.preventDefault();
            removeWindow(selectedWindowId);
            setSelectedWindowId(null);
          }
          break;
        
        case 'escape':
          // Deselect all and return to select mode
          e.preventDefault();
          setSelectedNodeId(null);
          setSelectedDoorId(null);
          setSelectedWindowId(null);
          setSelectedStairId(null);
          setInteractionMode('select');
          break;
      }

      // Save shortcut (Ctrl+S / Cmd+S)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        manualSave();
      }

      // Toggle shortcuts (Ctrl+K)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShortcutsEnabled(!shortcutsEnabled);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    shortcutsEnabled,
    interactionMode,
    selectedNodeId,
    selectedDoorId,
    selectedWindowId,
    selectedStairId,
    setInteractionMode,
    setSelectedNodeId,
    setSelectedDoorId,
    setSelectedWindowId,
    setSelectedStairId,
    rotateStair,
    removeDoor,
    removeWindow,
    manualSave,
    setShortcutsEnabled,
  ]);
};
