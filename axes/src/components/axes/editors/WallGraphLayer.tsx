import React from 'react';
import { useAxesStore } from '../../../store/useAxesStore';

interface WallGraphLayerProps {
    scale: number;
    offsetX: number;
    offsetY: number;
    activeFloor: string;
    handlePointerDown: (e: React.PointerEvent, id: string, type: 'wall_node' | 'stair') => void;
}

/**
 * Wall Graph Layer
 *
 * Renders the floor plan as a physical wall graph where:
 * - Nodes = physical wall corners/intersections (wall_node type)
 * - Links = physical wall segments between corners
 * - Rooms = polygons defined by ordered wall_node arrays
 *
 * This allows direct manipulation: dragging a node stretches the connected walls.
 * 
 * For legacy data (room adjacency graph format), this layer returns null
 * since rooms are rendered from GeoJSON in Layer 3.
 */
export const WallGraphLayer: React.FC<WallGraphLayerProps> = ({
    scale,
    offsetX,
    offsetY,
    activeFloor,
    handlePointerDown,
}) => {
    const { activeLayout, selectedNodeId, setSelectedNodeId, interactionMode, setSelectedLinkId, selectedLinkId } = useAxesStore();

    if (!activeLayout || activeFloor !== 'ground') return null;

    // Create node map for quick lookup
    const nodeMap = new Map(activeLayout.nodes.map(n => [n.id, n]));

    // Detect wall_node format vs room-adjacency format
    const hasWallNodes = activeLayout.nodes.some(n => n.type === 'wall_node');

    // Only render wall segments for wall_node format links
    const wallLinkKeys = new Set<string>();
    activeLayout.links?.forEach(link => {
        const sourceNode = nodeMap.get(link.source);
        const targetNode = nodeMap.get(link.target);
        if (sourceNode?.type === 'wall_node' && targetNode?.type === 'wall_node') {
            const key = [link.source, link.target].sort().join('-');
            wallLinkKeys.add(key);
        }
    });

    // Build adjacency map: which walls connect to each node
    const nodeWallMap = new Map<string, string[]>();
    wallLinkKeys.forEach(key => {
        const [sourceId, targetId] = key.split('-');
        if (!nodeWallMap.has(sourceId)) nodeWallMap.set(sourceId, []);
        if (!nodeWallMap.has(targetId)) nodeWallMap.set(targetId, []);
        nodeWallMap.get(sourceId)?.push(key);
        nodeWallMap.get(targetId)?.push(key);
    });

    return (
        <g className="wall-graph-layer">
            {/* ── Render Wall Segments (Links) — only for wall_node format ── */}
            {hasWallNodes && Array.from(wallLinkKeys).map((key, i) => {
                const [sourceId, targetId] = key.split('-');
                const sourceNode = nodeMap.get(sourceId);
                const targetNode = nodeMap.get(targetId);
                if (!sourceNode || !targetNode) return null;

                const sp = sourceNode.position || sourceNode.centroid || { x: 0, y: 0 };
                const tp = targetNode.position || targetNode.centroid || { x: 0, y: 0 };

                const x1 = (sp.x + offsetX) * scale;
                const y1 = (sp.y + offsetY) * scale;
                const x2 = (tp.x + offsetX) * scale;
                const y2 = (tp.y + offsetY) * scale;

                // Calculate wall angle for thickness rendering
                const dx = x2 - x1;
                const dy = y2 - y1;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                // Wall thickness in SVG units (20cm = 0.2m)
                const wallThicknessMeters = 0.2;
                const wallThicknessSvg = wallThicknessMeters * scale;

                const isSelected = selectedLinkId === `wall_${sourceId}_${targetId}` ||
                    selectedLinkId === `wall_${targetId}_${sourceId}`;

                return (
                    <g key={`wall-${i}`}>
                        {/* Invisible wider hit area for easier selection */}
                        <line
                            x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke="transparent"
                            strokeWidth={wallThicknessSvg * 4}
                            className="pointer-events-auto"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLinkId(`wall_${sourceId}_${targetId}`);
                            }}
                            style={{ cursor: 'pointer' }}
                        />

                        {/* Actual wall visual - hidden, relying on GeoJSON layer for visual, but keeping standard interaction hit box */}
                        <line
                            x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke={isSelected ? '#60a5fa' : 'transparent'}
                            strokeWidth={wallThicknessSvg / 2}
                            strokeLinecap="round"
                            className="transition-colors duration-200 pointer-events-none"
                            style={{
                                filter: isSelected ? 'drop-shadow(0 0 8px rgba(96,165,250,0.6))' : 'none',
                            }}
                        />
                    </g>
                );
            })}

            {/* ── Render Room Polygons (from rooms array) ── */}
            {activeLayout.rooms?.map(room => {
                if (!room.wall_nodes || room.wall_nodes.length < 3) return null;

                const points = room.wall_nodes
                    .map((nid: string) => {
                        const node = nodeMap.get(nid);
                        if (!node) return null;
                        const pos = node.position || node.centroid;
                        if (!pos) return null;
                        return `${(pos.x + offsetX) * scale},${(pos.y + offsetY) * scale}`;
                    })
                    .filter(Boolean);

                if (points.length < 3) return null;

                const isSelected = selectedNodeId === room.id || selectedNodeId === room.type.toLowerCase();
                const isHovered = false; // Could add hover logic if needed

                // Room colors
                const fillColors: Record<string, string> = {
                    living: 'rgba(59, 130, 246, 0.1)',
                    bedroom: 'rgba(139, 92, 246, 0.1)',
                    bathroom: 'rgba(6, 182, 212, 0.1)',
                    kitchen: 'rgba(245, 158, 11, 0.1)',
                    balcony: 'rgba(16, 185, 129, 0.1)',
                    dining: 'rgba(249, 115, 22, 0.1)',
                    study: 'rgba(99, 102, 241, 0.1)',
                    majlis: 'rgba(16, 185, 129, 0.1)',
                    garage: 'rgba(107, 114, 128, 0.1)',
                };

                const fill = fillColors[room.type.toLowerCase()] || 'rgba(255, 255, 255, 0.05)';

                return (
                    <g key={room.id}>
                        <polygon
                            points={points.join(' ')}
                            fill="transparent"
                            stroke={isSelected ? '#3b82f6' : 'transparent'}
                            strokeWidth={isSelected ? 3 : 0}
                            className="transition-all duration-200"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNodeId(room.id);
                            }}
                            style={{
                                cursor: 'pointer',
                                filter: isSelected ? 'drop-shadow(0 0 8px rgba(59,130,246,0.4))' : 'none',
                            }}
                        />
                    </g>
                );
            })}

            {/* ── Render Draggable Nodes (all types) ── */}
            {activeLayout.nodes
                .filter(node => node.type !== 'stair')
                .map(node => {
                    const pos = node.position || node.centroid || { x: 0, y: 0 };
                    const x = (pos.x + offsetX) * scale;
                    const y = (pos.y + offsetY) * scale;

                    const isWallNode = node.type === 'wall_node';
                    const isSelected = selectedNodeId === node.id;
                    const nodeDragging = interactionMode === 'move-node';

                    // For room-type nodes, only show when in edit move mode or selected
                    if (!isWallNode && !nodeDragging && !isSelected) return null;

                    const connectedWalls = nodeWallMap.get(node.id)?.length || 0;

                    return (
                        <g
                            key={node.id}
                            className={`transition-all duration-200 ${nodeDragging ? 'cursor-move' : 'cursor-pointer'}`}
                            onPointerDown={(e) => handlePointerDown(e, node.id, 'wall_node')}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNodeId(node.id);
                            }}
                        >
                            {/* Outer glow for selected */}
                            {isSelected && (
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={isWallNode ? 12 : 20}
                                    fill={isWallNode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.15)'}
                                    className="animate-pulse"
                                />
                            )}

                            {/* Main node circle */}
                            <circle
                                cx={x}
                                cy={y}
                                r={isWallNode ? (isSelected ? 6 : 4) : (isSelected ? 8 : 5)}
                                fill={isWallNode ? (isSelected ? '#3b82f6' : 'rgba(255,255,255,0.6)') : (isSelected ? '#3b82f6' : 'rgba(96,165,250,0.3)')}
                                stroke={isSelected ? '#60a5fa' : (isWallNode ? 'rgba(255,255,255,0.3)' : 'rgba(96,165,250,0.5)')}
                                strokeWidth={isSelected ? 3 : 2}
                                className="transition-all duration-200"
                            />

                            {/* Connection indicator for wall nodes */}
                            {isWallNode && connectedWalls > 2 && (
                                <text
                                    x={x}
                                    y={y - 10}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fill="#9ca3af"
                                    className="pointer-events-none"
                                >
                                    {connectedWalls}
                                </text>
                            )}
                        </g>
                    );
                })}

            {/* ── Render Stairs (as special nodes) ── */}
            {activeLayout.nodes
                .filter(node => node.type === 'stair')
                .map(node => {
                    const pos = node.position || node.centroid || { x: 0, y: 0 };
                    const x = (pos.x + offsetX) * scale;
                    const y = (pos.y + offsetY) * scale;

                    const isSelected = selectedNodeId === node.id;

                    return (
                        <g
                            key={node.id}
                            className={`transition-all duration-200 ${interactionMode === 'move-stair' ? 'cursor-move' : 'cursor-pointer'}`}
                            onPointerDown={(e) => handlePointerDown(e, node.id, 'stair')}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNodeId(node.id);
                            }}
                        >
                            {/* Stair rectangle */}
                            <rect
                                x={x - 10}
                                y={y - 15}
                                width={20}
                                height={30}
                                fill={isSelected ? '#ef4444' : 'rgba(239, 68, 68, 0.3)'}
                                stroke={isSelected ? '#f87171' : '#ef4444'}
                                strokeWidth={isSelected ? 3 : 2}
                                rx={2}
                                className="transition-all duration-200"
                            />

                            {/* Stair lines (symbolic) */}
                            <line
                                x1={x - 8}
                                y1={y - 10}
                                x2={x + 8}
                                y2={y - 10}
                                stroke="white"
                                strokeWidth="1"
                                opacity="0.6"
                            />
                            <line
                                x1={x - 8}
                                y1={y - 5}
                                x2={x + 8}
                                y2={y - 5}
                                stroke="white"
                                strokeWidth="1"
                                opacity="0.6"
                            />
                            <line
                                x1={x - 8}
                                y1={y}
                                x2={x + 8}
                                y2={y}
                                stroke="white"
                                strokeWidth="1"
                                opacity="0.6"
                            />
                            <line
                                x1={x - 8}
                                y1={y + 5}
                                x2={x + 8}
                                y2={y + 5}
                                stroke="white"
                                strokeWidth="1"
                                opacity="0.6"
                            />
                            <line
                                x1={x - 8}
                                y1={y + 10}
                                x2={x + 8}
                                y2={y + 10}
                                stroke="white"
                                strokeWidth="1"
                                opacity="0.6"
                            />
                        </g>
                    );
                })}
        </g>
    );
};
