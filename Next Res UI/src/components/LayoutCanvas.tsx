import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useResPlanData } from '../hooks/useResPlanData';
import type { Scope } from './RightPanel';
import { Maximize2, Minimize2 } from 'lucide-react';

import EditToolbar from './EditToolbar';
import type { EditTool } from './EditToolbar';
import { drawStructuralLabels } from './StructuralLabels';
import { drawAxesAndDims } from './drawAxesAndDims';

interface LayoutCanvasProps {
    scope: Scope;
    isEditMode?: boolean;
    setIsEditMode?: (mode: boolean) => void;
    forcedFloor?: string;
    isPrintMode?: boolean;
    activeTypes?: Record<string, string>;
}

const LayoutCanvas: React.FC<LayoutCanvasProps> = ({ scope, isEditMode = false, setIsEditMode, forcedFloor, isPrintMode, activeTypes }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const currentZoomRef = useRef<d3.ZoomTransform | null>(null);
    const { architecture, rooms, openings, nodes, elements, slabs, bom, structuralReport, levels, updateState, types } = useResPlanData();
    const [isFullScreen, setIsFullScreen] = useState(false);
    const availableLevels = scope === 'structural' ? (levels?.structural || []) : (levels?.architectural || []);
    
    let defaultId = availableLevels.length > 0 ? availableLevels[0].id : '';
    if (availableLevels.length > 0) {
        if (scope === 'architectural') {
            const archGround = availableLevels.find((l: any) => l.id === 'arch_ground');
            if (archGround) defaultId = archGround.id;
        } else if (scope === 'structural') {
            const strFirst = availableLevels.find((l: any) => l.id === 'str_first_story');
            if (strFirst) defaultId = strFirst.id;
        }
    }

    const [localFloor, setLocalFloor] = useState('');
    const selectedFloor = forcedFloor || localFloor || defaultId;
    const [activeTool, setActiveTool] = useState<EditTool>('select');
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
    
    const roomNames: Record<string, string> = { 'living': 'LIVING (🛋️)', 'bedroom': 'BEDROOM (🛏️)', 'bathroom': 'BATHROOM (🚽)', 'kitchen': 'KITCHEN (🍳)', 'default': 'ROOM' };

    useEffect(() => {
        if (localFloor && availableLevels.length > 0 && !availableLevels.some((l: any) => l.id === localFloor)) {
            setLocalFloor(''); // Reset if invalid
        }
    }, [scope, levels, localFloor, availableLevels]);

    useEffect(() => {
        if (!svgRef.current || nodes.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = 1200;
        const height = 800;

        try {
            // Create zoomable group
        const g = svg.append('g').attr('class', 'canvas-group');

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 50])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
                currentZoomRef.current = event.transform;
            });

        svg.call(zoom);

        svg.call(zoom);

        // Get selected floor elevation
        let activeZ = 0;
        const activeLevel = availableLevels.find((l: any) => l.id === selectedFloor);
        if (activeLevel) {
            activeZ = activeLevel.elevation_m;
        }

        // Filter nodes based on scope and activeZ
        let renderNodes = nodes;
        let renderElements = elements;
        
        if (scope === 'structural' || scope === 'architectural') {
            // For structural and architectural, only show nodes and elements associated with the activeZ elevation.
            // Beams: both nodes must be at activeZ.
            // Columns: base node or top node must be at activeZ.
            // Footings: base node must be at activeZ.
            
            // First find nodes at the exact Z elevation
            const zNodes = new Set(nodes.filter(n => Math.abs(n.z - activeZ) < 0.1).map(n => n.id));
            
            renderElements = elements.filter(e => {
                if (e.type === 'beam') {
                    return zNodes.has(e.n1) && zNodes.has(e.n2);
                } else if (e.type === 'column') {
                    const n1 = nodes.find((n:any) => n.id === e.n1);
                    const n2 = nodes.find((n:any) => n.id === e.n2);
                    if (!n1 || !n2) return false;
                    const minZ = Math.min(n1.z, n2.z);
                    const maxZ = Math.max(n1.z, n2.z);
                    return activeZ >= minZ - 0.1 && activeZ <= maxZ + 0.1;
                } else if (e.type === 'footing') {
                    return zNodes.has(e.n1);
                }
                return true;
            });
            
            // Collect all nodes referenced by renderElements to draw columns going up/down
            const elementNodes = new Set<number>();
            renderElements.forEach(e => {
                if (e.n1 !== undefined) elementNodes.add(e.n1);
                if (e.n2 !== undefined) elementNodes.add(e.n2);
            });
            
            renderNodes = nodes.filter(n => elementNodes.has(n.id) || Math.abs(n.z - activeZ) < 0.1);
        }

        // Calculate bounds to auto-fit
        const xs = renderNodes.length > 0 ? renderNodes.map(n => n.x) : [0];
        const ys = renderNodes.length > 0 ? renderNodes.map(n => n.y) : [0];
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        // ResPlan units are usually meters. We'll scale them up for display.
        const pxPerMeter = 100;
        
        const toPxX = (m: number) => (m - cx) * pxPerMeter;
        const toPxY = (m: number) => -(m - cy) * pxPerMeter; // invert Y for screen coords
        
        // Calculate dynamic bounds for zooming and grid
        const boundsWidth = Math.max((maxX - minX), 10);
        const boundsHeight = Math.max((maxY - minY), 10);
        
        // Auto-fit scale (with 1000px padding to clear axes and dimensions)
        const scaleX = width / (boundsWidth * pxPerMeter + 1000);
        const scaleY = height / (boundsHeight * pxPerMeter + 1000);
        const initialScale = Math.min(scaleX, scaleY, 2.5); // Max zoom

        // Initial transform to center and fit building
        if (currentZoomRef.current) {
            svg.call(zoom.transform, currentZoomRef.current);
        } else {
            svg.call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(initialScale));
        }

        // --- BACKGROUND / GRID LAYER ---
        drawAxesAndDims(svg, g, nodes, elements, toPxX, toPxY, minX, maxX, minY, maxY);

        // Draw grid based on scope
        if (scope === 'architectural' || scope === 'structural') {
            const gridGroup = g.append('g').attr('class', 'grid-lines').attr('opacity', 0.2);
            
            // Dynamic grid limit based on bounds + 10m padding
            const gridLimitX = Math.ceil(boundsWidth / 2) + 10;
            const gridLimitY = Math.ceil(boundsHeight / 2) + 10;
            
            for (let i = -gridLimitY; i <= gridLimitY; i++) {
                gridGroup.append('line').attr('x1', -gridLimitX * pxPerMeter).attr('y1', i * pxPerMeter).attr('x2', gridLimitX * pxPerMeter).attr('y2', i * pxPerMeter).attr('stroke', '#4b5563');
            }
            for (let i = -gridLimitX; i <= gridLimitX; i++) {
                gridGroup.append('line').attr('y1', -gridLimitY * pxPerMeter).attr('x1', i * pxPerMeter).attr('y2', gridLimitY * pxPerMeter).attr('x2', i * pxPerMeter).attr('stroke', '#4b5563');
            }
        }
        
        // Render architectural layer (Layer 0)
        const archOpacity = scope === 'architectural' ? 1.0 : (scope === 'structural' ? 0.2 : 0);
        
        let renderRooms = rooms || [];
        let renderArch = architecture || [];
        let renderOpenings = openings || [];

        if (scope === 'architectural') {
            renderRooms = renderRooms.filter((r: any) => !r.level_id || r.level_id === selectedFloor);
            renderArch = renderArch.filter((a: any) => !a.level_id || a.level_id === selectedFloor);
            renderOpenings = renderOpenings.filter((o: any) => !o.level_id || o.level_id === selectedFloor);
        } else if (scope === 'structural') {
            // In structural view, we might want to see the architectural outline of the corresponding floor.
            let correspondingArchLevel = 'arch_ground';
            if (selectedFloor === 'str_first_story') correspondingArchLevel = 'arch_first';
            if (selectedFloor === 'str_roof_slab') correspondingArchLevel = 'arch_roof';
            
            renderRooms = renderRooms.filter((r: any) => !r.level_id || r.level_id === correspondingArchLevel);
            renderArch = renderArch.filter((a: any) => !a.level_id || a.level_id === correspondingArchLevel);
            renderOpenings = renderOpenings.filter((o: any) => !o.level_id || o.level_id === correspondingArchLevel);
        }

        if (scope === 'architectural' || scope === 'structural') {
            const archGroup = g.append('g').attr('class', 'architecture-layer').attr('opacity', archOpacity);
            // Draw Rooms
            if (renderRooms.length > 0) {
                // Color map for room types
                const roomColors: Record<string, string> = {
                    'living': '#dcfce7', // green-100
                    'bedroom': '#dbeafe', // blue-100
                    'bathroom': '#fef3c7', // amber-100
                    'kitchen': '#fce7f3', // pink-100
                    'default': '#f3f4f6' // gray-100
                };
                
                renderRooms.forEach((room: any) => {
                    const roomCoords = Array.isArray(room.nodes) ? room.nodes.map((nid: any) => nodes.find((n:any) => n.id === nid)).filter(Boolean).map((n: any) => [n.x, n.y]) : [];
                    if (roomCoords.length > 2) {
                        const path = d3.path();
                        path.moveTo(toPxX(roomCoords[0][0]), toPxY(roomCoords[0][1]));
                        for(let i=1; i<roomCoords.length; i++) {
                            path.lineTo(toPxX(roomCoords[i][0]), toPxY(roomCoords[i][1]));
                        }
                        path.closePath();
                        
                        let color = '#f3f4f6';
                        let label = room.type ? room.type.toUpperCase() : 'ROOM';
                        
                        if (room.type_id && types?.rooms) {
                            const t = types.rooms.find((r: any) => r.id === room.type_id);
                            if (t) {
                                color = t.color;
                                label = t.label;
                            }
                        } else {
                            // Fallback for old untyped rooms
                            const roomColors: Record<string, string> = { 'living': '#dcfce7', 'bedroom': '#dbeafe', 'bathroom': '#fef3c7', 'kitchen': '#fce7f3', 'default': '#f3f4f6' };
                            color = roomColors[room.type] || roomColors['default'];
                            label = roomNames[room.type] || (room.type ? room.type.toUpperCase() : roomNames['default']);
                        }
                        
                        archGroup.append('path')
                            .attr('d', path.toString())
                            .attr('fill', color)
                            .attr('stroke', '#d1d5db')
                            .attr('stroke-width', 1);

                        if (scope === 'architectural') {
                            const rx = d3.mean(roomCoords, (c: any) => toPxX(c[0])) || 0;
                            const ry = d3.mean(roomCoords, (c: any) => toPxY(c[1])) || 0;
                            
                            if (editingRoomId === room.id) {
                                const fo = archGroup.append('foreignObject')
                                    .attr('x', rx - 60)
                                    .attr('y', ry - 15)
                                    .attr('width', 120)
                                    .attr('height', 30);
                                    
                                const optionsHtml = '<option value="living">LIVING</option><option value="bedroom">BEDROOM</option><option value="bathroom">BATHROOM</option><option value="kitchen">KITCHEN</option><option value="default">ROOM</option>';
                                
                                fo.html(`<select class="w-full h-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-1 outline-none text-sm cursor-pointer">${optionsHtml}</select>`);
                                
                                fo.select('select')
                                    .property('value', room.type || 'default')
                                    .on('change', (e: any) => {
                                        updateState({ rooms: rooms.map((rm: any) => rm.id === room.id ? { ...rm, type: e.target.value } : rm) });
                                        setEditingRoomId(null);
                                    })
                                    .on('blur', () => setEditingRoomId(null));
                            } else {
                                const fo = archGroup.append('foreignObject')
                                    .attr('x', rx - 100)
                                    .attr('y', ry - 15)
                                    .attr('width', 200)
                                    .attr('height', 30)
                                    .style('overflow', 'visible');
                                
                                fo.html(`
                                    <div class="flex items-center justify-center gap-2 w-full h-full">
                                        <button class="edit-room-btn text-zinc-500 hover:text-amber-500 transition-colors p-1 rounded-full hover:bg-zinc-800/50" title="Change Room Type">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                                        </button>
                                        <span class="text-[#4b5563] font-bold font-sans text-xl whitespace-nowrap pointer-events-none drop-shadow-sm">${roomNames[room.type] || roomNames['default']}</span>
                                    </div>
                                `);
                                
                                fo.select('.edit-room-btn').on('click', (e: any) => {
                                    e.stopPropagation();
                                    setEditingRoomId(room.id);
                                });
                            }
                        }
                    }
                });
            }

            // Draw Walls (with actual thickness - double parallel lines)
            if (renderArch.length > 0) {
                // Pass 1: Draw thick black outline
                renderArch.forEach((item: any) => {
                    if (item.type === 'wall' && item.n1 && item.n2) {
                        const n1 = nodes.find((n:any) => n.id === item.n1);
                        const n2 = nodes.find((n:any) => n.id === item.n2);
                        if (n1 && n2) {
                            const coords = [[n1.x, n1.y], [n2.x, n2.y]];
                            let typeThickness = 0.2;
                            if (item.type_id && types?.walls) {
                                const t = types.walls.find((w: any) => w.id === item.type_id);
                                if (t) typeThickness = t.thickness;
                            }
                            archGroup.append('line')
                                .attr('x1', toPxX(coords[0][0]))
                                .attr('y1', toPxY(coords[0][1]))
                                .attr('x2', toPxX(coords[1][0]))
                                .attr('y2', toPxY(coords[1][1]))
                                .attr('stroke', '#374151') // gray-700
                                .attr('stroke-width', typeThickness * pxPerMeter)
                                .attr('stroke-linecap', 'square')
                                .style('cursor', activeTool === 'remove_arch' ? 'pointer' : 'default')
                                .on('click', (e) => {
                                    if (activeTool === 'remove_arch') {
                                        e.stopPropagation();
                                        updateState({ architecture: architecture.filter((el: any) => el.id !== item.id) });
                                    }
                                });
                        }
                    }
                });
                
                // Pass 2: Draw inner white hollow fill to create parallel lines
                renderArch.forEach((item: any) => {
                    if (item.type === 'wall' && item.n1 && item.n2) {
                        const n1 = nodes.find((n:any) => n.id === item.n1);
                        const n2 = nodes.find((n:any) => n.id === item.n2);
                        if (n1 && n2) {
                            const coords = [[n1.x, n1.y], [n2.x, n2.y]];
                            let innerThickness = 0.16;
                            if (item.type_id && types?.walls) {
                                const t = types.walls.find((w: any) => w.id === item.type_id);
                                if (t) innerThickness = Math.max(0.05, t.thickness - 0.04);
                            }
                            archGroup.append('line')
                                .attr('x1', toPxX(coords[0][0]))
                                .attr('y1', toPxY(coords[0][1]))
                                .attr('x2', toPxX(coords[1][0]))
                                .attr('y2', toPxY(coords[1][1]))
                                .attr('stroke', '#f3f4f6') // gray-100 (matches default room color / background)
                                .attr('stroke-width', innerThickness * pxPerMeter) 
                                .attr('stroke-linecap', 'square');
                        }
                    }
                });
            }
            
            // Draw Openings (Doors/Windows)
            if (renderOpenings.length > 0) {
                renderOpenings.forEach((op: any) => {
                    // op has x, y, nx, ny, width, type, type_id
                    let width = op.width || 1.0;
                    if (op.type_id && types) {
                        const arr = op.type === 'window' ? types.windows : types.doors;
                        const t = arr?.find((t: any) => t.id === op.type_id);
                        if (t && t.width) width = t.width;
                    }
                    
                    const hW = (width / 2) * pxPerMeter;
                    const dirX = op.nx;
                    const dirY = -op.ny; // invert Y for screen
                    
                    const cx = toPxX(op.x);
                    const cy = toPxY(op.y);
                    
                    const x1 = cx - dirX * hW;
                    const y1 = cy - dirY * hW;
                    const x2 = cx + dirX * hW;
                    const y2 = cy + dirY * hW;
                    
                    let color = '#ffffff';
                    if (op.type === 'door' || op.type === 'front_door') color = '#fb923c'; // orange-400
                    if (op.type === 'window') color = '#38bdf8'; // sky-400
                    
                    const opGroup = archGroup.append('g')
                        .style('cursor', (activeTool === 'remove_door' && op.type === 'door') || (activeTool === 'remove_window' && op.type === 'window') ? 'pointer' : 'default')
                        .on('click', (e) => {
                            if ((activeTool === 'remove_door' && op.type === 'door') || (activeTool === 'remove_window' && op.type === 'window')) {
                                e.stopPropagation();
                                updateState({ openings: openings.filter((o: any) => o.id !== op.id) });
                            }
                        });
                        
                    opGroup.append('line')
                        .attr('x1', x1)
                        .attr('y1', y1)
                        .attr('x2', x2)
                        .attr('y2', y2)
                        .attr('stroke', color)
                        .attr('stroke-width', 0.22 * pxPerMeter) // slightly thicker than wall to stand out
                        .attr('stroke-linecap', 'butt');
                        
                    // add tiny text label
                    if (scope === 'architectural') {
                        opGroup.append('text')
                            .attr('x', cx)
                            .attr('y', cy - 12)
                            .attr('text-anchor', 'middle')
                            .attr('fill', color)
                            .attr('font-size', '10px')
                            .attr('font-weight', 'bold')
                            .text(op.type === 'window' ? 'W' : 'D');
                    }
                });
            }
            
            // Draw Plot Boundary (Setbacks)
            if (renderArch.length > 0 && scope === 'architectural') {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                renderArch.forEach((item: any) => {
                    if (item.type === 'wall' && item.n1 && item.n2) {
                        const n1 = nodes.find((n:any) => n.id === item.n1);
                        const n2 = nodes.find((n:any) => n.id === item.n2);
                        if (n1 && n2) {
                            const coords = [[n1.x, n1.y], [n2.x, n2.y]];
                            coords.forEach((c: any) => {
                            if (c[0] < minX) minX = c[0];
                            if (c[0] > maxX) maxX = c[0];
                            if (c[1] < minY) minY = c[1];
                            if (c[1] > maxY) maxY = c[1];
                        });
                        }
                    }
                });

                if (minX !== Infinity) {
                    const setbackX = 2; // 2m side setback
                    const setbackY = 3; // 3m front/back setback
                    
                    const pMinX = minX - setbackX;
                    const pMaxX = maxX + setbackX;
                    const pMinY = minY - setbackY;
                    const pMaxY = maxY + setbackY;
                    
                    archGroup.append('rect')
                        .attr('x', toPxX(pMinX))
                        .attr('y', toPxY(pMaxY)) // maxY is top edge due to inverted Y
                        .attr('width', (pMaxX - pMinX) * pxPerMeter)
                        .attr('height', (pMaxY - pMinY) * pxPerMeter)
                        .attr('fill', 'none')
                        .attr('stroke', '#6b7280') // gray-500
                        .attr('stroke-width', 2)
                        .attr('stroke-dasharray', '8,8');
                        
                    archGroup.append('text')
                        .attr('x', toPxX(pMinX) + 10)
                        .attr('y', toPxY(pMaxY) + 20)
                        .attr('fill', '#9ca3af')
                        .attr('font-size', '12px')
                        .attr('font-family', 'sans-serif')
                        .text('PLOT BOUNDARY (3m Front/Back, 2m Sides)');
                }
            }
        }

        // 1. Draw Slabs (Polygons)
        if (scope === 'structural' || scope === 'architectural') {
            slabs.forEach(slab => {
                const slabNodes = (slab.nodes || []).map((nid: number) => nodes.find(n => n.id === nid)).filter(Boolean);
                if (slabNodes.length > 2) {
                    const points = slabNodes.map((n: any) => `${toPxX(n.x)},${toPxY(n.y)}`).join(' ');
                    g.append('polygon')
                        .attr('points', points)
                        .attr('fill', scope === 'structural' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)')
                        .attr('stroke', scope === 'structural' ? '#3b82f6' : '#6b7280')
                        .attr('stroke-width', scope === 'structural' ? 2 : 1)
                        .attr('stroke-dasharray', scope === 'structural' ? '5,5' : '0');
                        
                    // Label
                    if (scope === 'structural') {
                        const midX = d3.mean(slabNodes, (n: any) => toPxX(n.x)) || 0;
                        const midY = d3.mean(slabNodes, (n: any) => toPxY(n.y)) || 0;
                        g.append('text')
                            .attr('x', midX)
                            .attr('y', midY)
                            .attr('text-anchor', 'middle')
                            .attr('fill', '#60a5fa')
                            .attr('font-size', '12px')
                            .attr('font-family', 'monospace')
                            .text(`SLAB ${slab.id}`);
                    }
                }
            });
        }

        // 2. Draw Beams
        const beams = elements.filter(e => e.type === 'beam');
        beams.forEach(beam => {
            const n1 = nodes.find(n => n.id === beam.n1);
            const n2 = nodes.find(n => n.id === beam.n2);
            if (n1 && n2) {
                g.append('line')
                    .attr('x1', toPxX(n1.x)).attr('y1', toPxY(n1.y))
                    .attr('x2', toPxX(n2.x)).attr('y2', toPxY(n2.y))
                    .attr('stroke', scope === 'structural' ? '#fbbf24' : '#9ca3af') // Amber for struct
                    .attr('stroke-width', scope === 'structural' ? 8 : 4)
                    .attr('stroke-linecap', 'round');
            }
        });

        // 3. Draw Columns (as squares/circles at nodes)
        const columns = elements.filter(e => e.type === 'column');
        // Extract unique column base/top nodes
        const colNodes = new Set();
        columns.forEach(c => { colNodes.add(c.n1); colNodes.add(c.n2); });
        
        colNodes.forEach(nid => {
            const n = nodes.find(node => node.id === nid);
            if (n) {
                if (scope === 'structural') {
                    // Draw a chunky red square for columns in structural view
                    g.append('rect')
                        .attr('x', toPxX(n.x) - 15)
                        .attr('y', toPxY(n.y) - 15)
                        .attr('width', 30)
                        .attr('height', 30)
                        .attr('fill', '#ef4444')
                        .attr('stroke', '#991b1b')
                        .attr('stroke-width', 2);
                } else {
                    // Just a dot for architectural
                    g.append('circle')
                        .attr('cx', toPxX(n.x))
                        .attr('cy', toPxY(n.y))
                        .attr('r', 6)
                        .attr('fill', '#d1d5db');
                }
            }
        });
        
        // 4. Draw Structural Labels
        drawStructuralLabels(g, elements, nodes, bom, toPxX, toPxY, scope, isPrintMode || false);
        
        // 5. Plumbing Scope Placeholder
        if (scope === 'plumbing') {
            g.append('text')
                .attr('x', 0)
                .attr('y', 0)
                .attr('text-anchor', 'middle')
                .attr('fill', '#22d3ee')
                .attr('font-size', '24px')
                .text('Plumbing Scope Active - No Wet Zones Defined');
        }

        } catch (err) {
            console.error("D3 Rendering Error:", err);
            svg.append('text').attr('x', 50).attr('y', 50).text('Render Error: ' + err).attr('fill', 'red');
        }
    }, [architecture, rooms, openings, nodes, elements, slabs, scope, localFloor, forcedFloor]);

    return (
        <div className={`relative bg-zinc-950 rounded-xl overflow-hidden shadow-2xl border border-zinc-800 ${isFullScreen ? 'fixed inset-0 z-40 rounded-none' : 'w-full h-[800px]'}`}>
            <button 
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="absolute top-4 right-4 p-2 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-lg backdrop-blur z-50 transition"
            >
                {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <svg ref={svgRef} className="w-full h-full cursor-move" viewBox="0 0 1200 800" />
            
            {/* Legend */}
            <div className="absolute bottom-6 left-6 bg-zinc-900/90 p-4 rounded-lg border border-zinc-700/50 backdrop-blur-md">
                <h3 className="text-zinc-200 text-sm font-semibold mb-3 uppercase tracking-wider">{scope} Legend</h3>
                <div className="space-y-2 text-sm text-zinc-400">
                    {scope === 'structural' && (
                        <>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded-sm"></div> Columns</div>
                            <div className="flex items-center gap-2"><div className="w-4 h-1 bg-amber-400"></div> Beams</div>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-dashed border-blue-500 bg-blue-500/10"></div> Slab Panels</div>
                        </>
                    )}
                    {scope === 'architectural' && (
                        <>
                            <div className="flex items-center gap-2"><div className="w-4 h-2 bg-gray-700"></div> Load-bearing Walls</div>
                            <div className="flex items-center gap-2">
                                <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#6b7280" strokeWidth="2" strokeDasharray="4,4" /></svg>
                                Plot Line
                            </div>
                            <div className="flex items-center gap-2"><div className="w-4 h-2 bg-orange-400"></div> Doors</div>
                            <div className="flex items-center gap-2"><div className="w-4 h-2 bg-sky-400"></div> Windows</div>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 border border-gray-300"></div> Living Spaces</div>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-100 border border-gray-300"></div> Bedrooms</div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LayoutCanvas;
