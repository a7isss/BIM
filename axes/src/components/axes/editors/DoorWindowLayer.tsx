import React, { useState, useRef, useEffect } from 'react';
import { useAxesStore } from '../../../store/useAxesStore';
import { calculateDistanceAlongWall, formatDistance } from './geojsonUtils';

interface DoorWindowLayerProps {
  svgRef: React.RefObject<SVGSVGElement>;
  containerBounds: DOMRect | null;
  buildingBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

/**
 * Door and Window Placement Layer
 * Handles:
 * - Door placement: 2-step (select wall, then place)
 * - Window placement: click external wall
 * - Drag to adjust position
 * - Delete selected
 */
export const DoorWindowLayer: React.FC<DoorWindowLayerProps> = ({
  svgRef,
  containerBounds,
  buildingBounds,
}) => {
  const {
    interactionMode,
    activeLayout,
    selectedNodeId,
    addDoor,
    addWindow,
    updateDoorPosition,
    updateWindowPosition,
    removeDoor,
    removeWindow,
    setSelectedDoorId,
    setSelectedWindowId,
    selectedDoorId,
    selectedWindowId,
  } = useAxesStore();

  const [selectedWall, setSelectedWall] = useState<{
    side: 'north' | 'south' | 'east' | 'west';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState<{
    type: 'door' | 'window';
    id: string;
  } | null>(null);

  // Handle wall click for door placement
  const handleWallClick = (e: React.MouseEvent, side: 'north' | 'south' | 'east' | 'west') => {
    if (interactionMode !== 'place-door') return;
    if (!svgRef.current || !buildingBounds) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Set selected wall
    const wall = getWallBounds(side, buildingBounds);
    setSelectedWall({ side, ...wall });

    // Place door at click position (constrained to wall)
    const constrainedPos = constrainToWall(x, y, wall);
    
    addDoor({
      position: constrainedPos,
      rotation: side === 'north' || side === 'south' ? 0 : 90,
      width: 0.9,
      wallSide: side,
    });

    // Reset wall selection after short delay
    setTimeout(() => setSelectedWall(null), 1000);
  };

  // Handle window click (external walls only)
  const handleWindowClick = (e: React.MouseEvent, side: 'north' | 'south' | 'east' | 'west') => {
    if (interactionMode !== 'place-window') return;
    if (!svgRef.current || !buildingBounds) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const wall = getWallBounds(side, buildingBounds);
    const constrainedPos = constrainToWall(x, y, wall);

    addWindow({
      position: constrainedPos,
      rotation: side === 'north' || side === 'south' ? 0 : 90,
      width: 1.2,
      wallSide: side,
    });
  };

  // Handle mouse move for preview
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current || !buildingBounds) return;

    if (interactionMode === 'place-door' && selectedWall) {
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setPreviewPosition(constrainToWall(x, y, selectedWall));
    } else if (interactionMode === 'place-window') {
      // Show preview on external walls only
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const side = getNearestExternalWall(x, y, buildingBounds);
      if (side) {
        const wall = getWallBounds(side, buildingBounds);
        setPreviewPosition(constrainToWall(x, y, wall));
      } else {
        setPreviewPosition(null);
      }
    }
  };

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent, id: string, type: 'door' | 'window') => {
    e.stopPropagation();
    if (interactionMode === 'select' || interactionMode === 'move-node') {
      setIsDragging({ type, id });
      
      if (type === 'door') {
        setSelectedDoorId(id);
        setSelectedWindowId(null);
      } else {
        setSelectedWindowId(id);
        setSelectedDoorId(null);
      }
    }
  };

  // Handle drag
  const handleDrag = (e: React.MouseEvent) => {
    if (!isDragging || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging.type === 'door') {
      updateDoorPosition(isDragging.id, { x, y });
    } else {
      updateWindowPosition(isDragging.id, { x, y });
    }
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(null);
  };

  // Handle delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDoorId) {
          removeDoor(selectedDoorId);
          setSelectedDoorId(null);
        } else if (selectedWindowId) {
          removeWindow(selectedWindowId);
          setSelectedWindowId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDoorId, selectedWindowId, removeDoor, removeWindow, setSelectedDoorId, setSelectedWindowId]);

  if (!buildingBounds) return null;

  return (
    <g
      onMouseMove={handleMouseMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      {/* Wall click handlers for door placement */}
      {interactionMode === 'place-door' && (
        <>
          {/* North wall */}
          <rect
            x={buildingBounds.minX}
            y={buildingBounds.minY - 20}
            width={buildingBounds.maxX - buildingBounds.minX}
            height={40}
            fill="transparent"
            stroke={selectedWall?.side === 'north' ? '#3b82f6' : '#3b82f6'}
            strokeWidth={selectedWall?.side === 'north' ? 3 : 1}
            strokeDasharray={selectedWall?.side === 'north' ? 'none' : '5,5'}
            opacity={selectedWall?.side === 'north' ? 0.5 : 0.3}
            style={{ cursor: 'crosshair' }}
            onClick={(e) => handleWallClick(e, 'north')}
          />
          {/* South wall */}
          <rect
            x={buildingBounds.minX}
            y={buildingBounds.maxY - 20}
            width={buildingBounds.maxX - buildingBounds.minX}
            height={40}
            fill="transparent"
            stroke={selectedWall?.side === 'south' ? '#3b82f6' : '#3b82f6'}
            strokeWidth={selectedWall?.side === 'south' ? 3 : 1}
            strokeDasharray={selectedWall?.side === 'south' ? 'none' : '5,5'}
            opacity={selectedWall?.side === 'south' ? 0.5 : 0.3}
            style={{ cursor: 'crosshair' }}
            onClick={(e) => handleWallClick(e, 'south')}
          />
          {/* East wall */}
          <rect
            x={buildingBounds.maxX - 20}
            y={buildingBounds.minY}
            width={40}
            height={buildingBounds.maxY - buildingBounds.minY}
            fill="transparent"
            stroke={selectedWall?.side === 'east' ? '#3b82f6' : '#3b82f6'}
            strokeWidth={selectedWall?.side === 'east' ? 3 : 1}
            strokeDasharray={selectedWall?.side === 'east' ? 'none' : '5,5'}
            opacity={selectedWall?.side === 'east' ? 0.5 : 0.3}
            style={{ cursor: 'crosshair' }}
            onClick={(e) => handleWallClick(e, 'east')}
          />
          {/* West wall */}
          <rect
            x={buildingBounds.minX - 20}
            y={buildingBounds.minY}
            width={40}
            height={buildingBounds.maxY - buildingBounds.minY}
            fill="transparent"
            stroke={selectedWall?.side === 'west' ? '#3b82f6' : '#3b82f6'}
            strokeWidth={selectedWall?.side === 'west' ? 3 : 1}
            strokeDasharray={selectedWall?.side === 'west' ? 'none' : '5,5'}
            opacity={selectedWall?.side === 'west' ? 0.5 : 0.3}
            style={{ cursor: 'crosshair' }}
            onClick={(e) => handleWallClick(e, 'west')}
          />
        </>
      )}

      {/* Wall click handlers for window placement (external walls only) */}
      {interactionMode === 'place-window' && (
        <>
          {/* North wall */}
          <rect
            x={buildingBounds.minX}
            y={buildingBounds.minY - 20}
            width={buildingBounds.maxX - buildingBounds.minX}
            height={40}
            fill="transparent"
            stroke="#fbbf24"
            strokeWidth={1}
            strokeDasharray="5,5"
            opacity={0.3}
            style={{ cursor: 'crosshair' }}
            onClick={(e) => handleWindowClick(e, 'north')}
          />
          {/* South wall */}
          <rect
            x={buildingBounds.minX}
            y={buildingBounds.maxY - 20}
            width={buildingBounds.maxX - buildingBounds.minX}
            height={40}
            fill="transparent"
            stroke="#fbbf24"
            strokeWidth={1}
            strokeDasharray="5,5"
            opacity={0.3}
            style={{ cursor: 'crosshair' }}
            onClick={(e) => handleWindowClick(e, 'south')}
          />
          {/* East wall */}
          <rect
            x={buildingBounds.maxX - 20}
            y={buildingBounds.minY}
            width={40}
            height={buildingBounds.maxY - buildingBounds.minY}
            fill="transparent"
            stroke="#fbbf24"
            strokeWidth={1}
            strokeDasharray="5,5"
            opacity={0.3}
            style={{ cursor: 'crosshair' }}
            onClick={(e) => handleWindowClick(e, 'east')}
          />
          {/* West wall */}
          <rect
            x={buildingBounds.minX - 20}
            y={buildingBounds.minY}
            width={40}
            height={buildingBounds.maxY - buildingBounds.minY}
            fill="transparent"
            stroke="#fbbf24"
            strokeWidth={1}
            strokeDasharray="5,5"
            opacity={0.3}
            style={{ cursor: 'crosshair' }}
            onClick={(e) => handleWindowClick(e, 'west')}
          />
        </>
      )}

      {/* Preview indicator with distance */}
      {previewPosition && selectedWall && (
        <g>
          {/* Preview circle */}
          <circle
            cx={previewPosition.x}
            cy={previewPosition.y}
            r={8}
            fill={interactionMode === 'place-door' ? '#3b82f6' : '#fbbf24'}
            opacity={0.6}
            stroke="white"
            strokeWidth={2}
            strokeDasharray="2,2"
          />
          
          {/* Distance line from wall start */}
          <line
            x1={selectedWall.x1}
            y1={selectedWall.y1}
            x2={previewPosition.x}
            y2={previewPosition.y}
            stroke={interactionMode === 'place-door' ? '#3b82f6' : '#fbbf24'}
            strokeWidth="0.5"
            strokeDasharray="2,2"
            opacity="0.5"
          />
          
          {/* Distance label */}
          {(() => {
            const { distance } = calculateDistanceAlongWall(previewPosition, selectedWall);
            const midpoint = {
              x: (selectedWall.x1 + previewPosition.x) / 2,
              y: (selectedWall.y1 + previewPosition.y) / 2,
            };
            return (
              <>
                <text
                  x={midpoint.x}
                  y={midpoint.y - 4}
                  fontSize="7"
                  fill={interactionMode === 'place-door' ? '#3b82f6' : '#fbbf24'}
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {formatDistance(distance)}
                </text>
                {/* Wall length indicator */}
                <text
                  x={(selectedWall.x1 + selectedWall.x2) / 2}
                  y={(selectedWall.y1 + selectedWall.y2) / 2 - 6}
                  fontSize="6"
                  fill="#9ca3af"
                  textAnchor="middle"
                >
                  Wall: {formatDistance(Math.sqrt(
                    Math.pow(selectedWall.x2 - selectedWall.x1, 2) +
                    Math.pow(selectedWall.y2 - selectedWall.y1, 2)
                  ))}
                </text>
              </>
            );
          })()}
        </g>
      )}

      {/* Render existing doors for dragging */}
      {activeLayout?.doors?.map(door => (
        <g
          key={door.id}
          transform={`translate(${door.position.x}, ${door.position.y}) rotate(${door.rotation})`}
          onMouseDown={(e) => handleDragStart(e, door.id, 'door')}
          style={{ cursor: 'move' }}
          opacity={isDragging?.id === door.id ? 0.7 : 1}
        >
          {/* Door panel */}
          <rect
            x={0}
            y={-2}
            width={door.width * 30}
            height={4}
            fill={selectedDoorId === door.id ? '#3b82f6' : '#1e40af'}
            stroke={selectedDoorId === door.id ? '#60a5fa' : '#1e3a8a'}
            strokeWidth={selectedDoorId === door.id ? 3 : 2}
            rx={2}
          />
          {/* Selection handles */}
          {selectedDoorId === door.id && (
            <>
              <circle cx={0} cy={0} r={6} fill="#3b82f6" opacity={0.5} />
              <circle cx={door.width * 30} cy={0} r={6} fill="#3b82f6" opacity={0.5} />
            </>
          )}
        </g>
      ))}

      {/* Render existing windows for dragging */}
      {activeLayout?.windows?.map(window => (
        <g
          key={window.id}
          transform={`translate(${window.position.x}, ${window.position.y}) rotate(${window.rotation})`}
          onMouseDown={(e) => handleDragStart(e, window.id, 'window')}
          style={{ cursor: 'move' }}
          opacity={isDragging?.id === window.id ? 0.7 : 1}
        >
          {/* Window frame */}
          <rect
            x={-window.width * 15}
            y={-3}
            width={window.width * 30}
            height={6}
            fill={selectedWindowId === window.id ? '#fbbf24' : '#fcd34d'}
            stroke={selectedWindowId === window.id ? '#f59e0b' : '#d97706'}
            strokeWidth={selectedWindowId === window.id ? 3 : 2}
            rx={1}
          />
          {/* Selection handles */}
          {selectedWindowId === window.id && (
            <>
              <circle cx={-window.width * 15} cy={0} r={6} fill="#fbbf24" opacity={0.5} />
              <circle cx={window.width * 15} cy={0} r={6} fill="#fbbf24" opacity={0.5} />
            </>
          )}
        </g>
      ))}
    </g>
  );
};

// ── Helper Functions ─────────────────────────────────────────────────────────

function getWallBounds(
  side: 'north' | 'south' | 'east' | 'west',
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
) {
  switch (side) {
    case 'north':
      return { x1: bounds.minX, y1: bounds.minY, x2: bounds.maxX, y2: bounds.minY };
    case 'south':
      return { x1: bounds.minX, y1: bounds.maxY, x2: bounds.maxX, y2: bounds.maxY };
    case 'east':
      return { x1: bounds.maxX, y1: bounds.minY, x2: bounds.maxX, y2: bounds.maxY };
    case 'west':
      return { x1: bounds.minX, y1: bounds.minY, x2: bounds.minX, y2: bounds.maxY };
  }
}

function constrainToWall(
  x: number,
  y: number,
  wall: { x1: number; y1: number; x2: number; y2: number }
): { x: number; y: number } {
  // For horizontal walls (north/south), constrain Y to wall Y, keep X
  if (wall.y1 === wall.y2) {
    const constrainedX = Math.max(wall.x1, Math.min(wall.x2, x));
    return { x: constrainedX, y: wall.y1 };
  }
  // For vertical walls (east/west), constrain X to wall X, keep Y
  if (wall.x1 === wall.x2) {
    const constrainedY = Math.max(wall.y1, Math.min(wall.y2, y));
    return { x: wall.x1, y: constrainedY };
  }
  return { x, y };
}

function getNearestExternalWall(
  x: number,
  y: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): 'north' | 'south' | 'east' | 'west' | null {
  const distToNorth = Math.abs(y - bounds.minY);
  const distToSouth = Math.abs(y - bounds.maxY);
  const distToEast = Math.abs(x - bounds.maxX);
  const distToWest = Math.abs(x - bounds.minX);

  const minDist = Math.min(distToNorth, distToSouth, distToEast, distToWest);

  // Only return wall if within 30 pixels
  if (minDist > 30) return null;

  if (minDist === distToNorth) return 'north';
  if (minDist === distToSouth) return 'south';
  if (minDist === distToEast) return 'east';
  if (minDist === distToWest) return 'west';

  return null;
}
