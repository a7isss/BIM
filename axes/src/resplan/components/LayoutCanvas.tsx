import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useResPlanData } from '../hooks/useResPlanData';
import type { Scope, ResPlanData } from '../types';
import { Maximize2, Minimize2 } from 'lucide-react';

import type { EditTool } from '../types';
import type { EntityRef } from '../utils/entityOps';
import { deleteEntity, moveEntity, getEntityPosition, copyEntity, findClosestEntity } from '../utils/entityOps';
import { drawAxesAndDims } from './drawAxesAndDims';
import { drawArchitecture } from './drawArchitecture';
import { drawStructure } from './drawStructure';
import FurnitureCatalogPanel from './FurnitureCatalogPanel';

interface LayoutCanvasProps {
    scope: Scope;
    isEditMode?: boolean;
    setIsEditMode?: (mode: boolean) => void;
    forcedFloor?: string;
    isPrintMode?: boolean;
    activeTypes?: Record<string, string>;
    activeTool?: EditTool;
    setActiveTool?: (tool: EditTool) => void;
    showAreaLabels?: boolean;
}

const LayoutCanvas: React.FC<LayoutCanvasProps> = ({ scope, forcedFloor, isPrintMode, activeTypes, isEditMode, setIsEditMode, activeTool: propActiveTool, setActiveTool: propSetActiveTool, showAreaLabels }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const currentZoomRef = useRef<d3.ZoomTransform | null>(null);
    const { architecture, rooms, openings, nodes, elements, slabs, bom, levels, touchups, annotations, updateState, types, project_info } = useResPlanData();
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
    const [localActiveTool, setLocalActiveTool] = useState<EditTool>('select');
    const activeTool = propActiveTool ?? localActiveTool;
    const setActiveTool = propSetActiveTool ?? setLocalActiveTool;
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
    const [selectedEntity, setSelectedEntity] = useState<EntityRef | null>(null);
    const [drawingSequence, setDrawingSequence] = useState<(string | number)[]>([]);
    const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
    
    // Dimension drawing (two-click)
    const dimensionStartRef = useRef<{ x: number; y: number } | null>(null);

    // Drag state for Move tool
    const dragStateRef = useRef<{
        entityRef: EntityRef;
        startWorldX: number;
        startWorldY: number;
        startMouseX: number;
        startMouseY: number;
    } | null>(null);
    const centerRef = useRef({ cx: 0, cy: 0 });
    const dataRef = useRef<ResPlanData>(null as any);

    // Touch Up State
    const [activeFurnitureId, setActiveFurnitureId] = useState<string>('');
    const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);

    useEffect(() => {
        if (activeTool === 'add_touchup') {
            setIsCatalogOpen(true);
            // Default select the first furniture if none selected
            if (!activeFurnitureId && types?.furniture?.length > 0) {
                setActiveFurnitureId(types.furniture[0].id);
            }
        } else {
            setIsCatalogOpen(false);
        }
    }, [activeTool, types, activeFurnitureId]);

    // Clear sequence when tool changes
    useEffect(() => {
        setDrawingSequence([]);
        setMousePos(null);
    }, [activeTool, selectedFloor]);
    

    useEffect(() => {
        if (localFloor && availableLevels.length > 0 && !availableLevels.some((l: any) => l.id === localFloor)) {
            setLocalFloor(''); // Reset if invalid
        }
    }, [scope, levels, localFloor, availableLevels]);

    useEffect(() => {
        if (activeTool !== 'move' && activeTool !== 'select') {
            setSelectedEntity(null);
        }
    }, [activeTool]);

    useEffect(() => {
        if (!isEditMode || !selectedEntity) return;
        if (activeTool !== 'move' && activeTool !== 'select') return;

        const data = { nodes, elements, slabs, architecture, rooms, openings, levels: { architectural: [], structural: [] }, touchups, annotations, types: {} };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            e.preventDefault();

            const inc = e.shiftKey ? 5 : 0.05;
            let dx = 0, dy = 0, drot = 0;

            if (e.shiftKey) {
                if (e.key === 'ArrowLeft') drot = -inc;
                if (e.key === 'ArrowRight') drot = inc;
            } else {
                if (e.key === 'ArrowUp') dy = 1;
                if (e.key === 'ArrowDown') dy = -1;
                if (e.key === 'ArrowLeft') dx = -1;
                if (e.key === 'ArrowRight') dx = 1;
            }

            if (selectedEntity.type === 'touchup' && drot !== 0) {
                const tu = touchups.find(t => t.id === selectedEntity.id);
                if (tu) {
                    updateState({ touchups: touchups.map(t => t.id === tu.id ? { ...t, rotation: (t.rotation || 0) + drot } : t) });
                }
            }

            if (dx !== 0 || dy !== 0) {
                const pos = getEntityPosition(data as any, selectedEntity);
                if (pos) {
                    updateState(moveEntity(data as any, selectedEntity, pos.x + dx * inc, pos.y + dy * inc));
                }
            }
        };

        const handleKeyDownDelete = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                updateState(deleteEntity(data as any, selectedEntity));
                setSelectedEntity(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keydown', handleKeyDownDelete);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keydown', handleKeyDownDelete);
        };
    }, [isEditMode, activeTool, selectedEntity, elements, nodes, openings, touchups, architecture, rooms, slabs, updateState]);

    // Keep dataRef in sync with current state (used by drag handlers to avoid effect re-creation)
    useEffect(() => {
        dataRef.current = { nodes, elements, slabs, architecture, rooms, openings, levels: { architectural: [], structural: [] }, touchups, annotations, types: {} } as any;
    }, [nodes, elements, slabs, architecture, rooms, openings, touchups, annotations]);

    // Mouse drag for Move tool — stable listeners that read from refs
    useEffect(() => {
        if (!isEditMode || activeTool !== 'move') return;

        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            const svg = svgRef.current;
            if (!svg || !svg.contains(e.target as Node)) return;

            const [px, py] = d3.pointer(e, svg);
            const t = currentZoomRef.current || d3.zoomIdentity;
            const gx = (px - t.x) / t.k;
            const gy = (py - t.y) / t.k;
            const { cx, cy } = centerRef.current;
            const worldX = gx / 100 + cx;
            const worldY = cy - gy / 100;

            const data = dataRef.current;
            const target = findClosestEntity(data, worldX, worldY, 0.3);
            if (!target) return;

            const pos = getEntityPosition(data, target);
            if (!pos) return;

            setSelectedEntity(target);
            dragStateRef.current = {
                entityRef: target,
                startWorldX: pos.x,
                startWorldY: pos.y,
                startMouseX: e.clientX,
                startMouseY: e.clientY,
            };
        };

        const onMouseMove = (e: MouseEvent) => {
            const ds = dragStateRef.current;
            if (!ds) return;

            const t = currentZoomRef.current || d3.zoomIdentity;
            const screenDx = e.clientX - ds.startMouseX;
            const screenDy = e.clientY - ds.startMouseY;
            const worldDx = screenDx / (t.k * 100);
            const worldDy = -screenDy / (t.k * 100);

            updateState(moveEntity(dataRef.current, ds.entityRef, ds.startWorldX + worldDx, ds.startWorldY + worldDy));
        };

        const onMouseUp = () => {
            dragStateRef.current = null;
        };

        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            dragStateRef.current = null;
        };
    }, [isEditMode, activeTool, updateState]);

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
            
            // Zoom/pan always active; creation tools capture clicks via node interaction layer
            // which stops propagation to prevent zoom interference

        // Get selected floor elevation
        let activeZ = 0;
        const activeLevel = availableLevels.find((l: any) => l.id === selectedFloor);
        if (activeLevel) {
            activeZ = activeLevel.elevation_m;
        }

        // Filter nodes based on scope and activeZ
        let renderNodes = nodes;
        let renderElements = elements;
        let renderSlabs = slabs;
        
        if (scope === 'structural' || scope === 'architectural') {
            // For structural and architectural, only show nodes and elements associated with the activeZ elevation.
            // Beams: both nodes must be at activeZ.
            // Columns: base node or top node must be at activeZ.
            // Footings: base node must be at activeZ.
            
            // First find nodes at the exact Z elevation
            const zNodes = new Set(nodes.filter(n => Math.abs(n.z - activeZ) < 0.1).map(n => n.id));
            
            renderSlabs = slabs.filter(s => {
                if (!s.nodes) return false;
                return s.nodes.some((nid: string | number) => zNodes.has(nid));
            });
            
            renderElements = elements.filter(e => {
                if (e.type === 'beam') {
                    if (e.n1 === undefined || e.n2 === undefined) return false;
                    return zNodes.has(e.n1) && zNodes.has(e.n2);
                } else if (e.type === 'column') {
                    const n1 = nodes.find((n:any) => n.id === e.n1);
                    const n2 = nodes.find((n:any) => n.id === e.n2);
                    if (!n1 || !n2) return false;
                    const minZ = Math.min(n1.z, n2.z);
                    const maxZ = Math.max(n1.z, n2.z);
                    return activeZ >= minZ - 0.1 && activeZ <= maxZ + 0.1;
                } else if (e.type === 'footing') {
                    if (e.n1 === undefined) return false;
                    return zNodes.has(e.n1);
                }
                return true;
            });
            
            // Collect all nodes referenced by renderElements to draw columns going up/down
            const elementNodes = new Set<string | number>();
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
        centerRef.current = { cx, cy };

        // ResPlan units are usually meters. We'll scale them up for display.
        const pxPerMeter = 100;
        
        const toPxX = (m: number) => (m - cx) * pxPerMeter;
        const toPxY = (m: number) => -(m - cy) * pxPerMeter; // invert Y for screen coords
        
        const fromPxX = (px: number) => px / pxPerMeter + cx;
        const fromPxY = (py: number) => cy - (py / pxPerMeter);
        
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
        drawAxesAndDims(g, nodes, elements, toPxX, toPxY, minX, maxX, minY, maxY);

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
            drawArchitecture(
                g, renderRooms, renderArch, renderOpenings, nodes, types,
                toPxX, toPxY, fromPxX, fromPxY, pxPerMeter, scope, activeTool, rooms, architecture, openings,
                updateState, editingRoomId, setEditingRoomId, archOpacity, selectedFloor,
                selectedEntity, setSelectedEntity, project_info);
        }

        if (scope === 'structural' || scope === 'architectural') {
            drawStructure(
                g, renderSlabs, renderElements, renderNodes, nodes, bom,
                toPxX, toPxY, pxPerMeter, scope, isPrintMode || false, activeTool, elements, updateState,
                selectedEntity, setSelectedEntity
            );
        }
        
        // 4.5 Optional Room Area Labels
        if (showAreaLabels && (scope === 'architectural' || scope === 'structural')) {
            const areaGroup = g.append('g').attr('class', 'area-label-layer').style('pointer-events', 'none');
            renderRooms.forEach((r: any) => {
                const pts = (r.nodes || []).map((id: any) => nodes.find((n: any) => n.id === id)).filter(Boolean);
                if (pts.length < 3) return;
                // Shoelace formula
                let area = 0;
                for (let i = 0; i < pts.length; i++) {
                    const j = (i + 1) % pts.length;
                    area += pts[i].x * pts[j].y;
                    area -= pts[j].x * pts[i].y;
                }
                area = Math.abs(area) / 2;
                // Centroid
                let cx = 0, cy = 0;
                for (const p of pts) { cx += p.x; cy += p.y; }
                cx /= pts.length; cy /= pts.length;
                areaGroup.append('text')
                    .attr('x', toPxX(cx)).attr('y', toPxY(cy))
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#22d3ee')
                    .attr('font-size', '10px')
                    .attr('opacity', 0.8)
                    .text(`${area.toFixed(1)} m²`);
            });
        }

        // 4.6 Touch Up Layer
        if (scope === 'architectural') {
            const touchupGroup = g.append('g').attr('class', 'touchup-layer');
            const renderTouchups = touchups.filter(t => !t.level_id || t.level_id === selectedFloor);
            
            renderTouchups.forEach(tu => {
                const fType = types?.furniture?.find((f: any) => f.id === tu.type_id);
                if (fType && fType.svg_path) {
                    const px = toPxX(tu.x);
                    const py = toPxY(tu.y);
                    const isSelected = selectedEntity?.id === tu.id && selectedEntity?.type === 'touchup';
                    
                    const el = touchupGroup.append('g')
                        .attr('transform', `translate(${px},${py}) rotate(${tu.rotation || 0}) scale(${tu.scale || 1})`);
                        
                    // Centered 1x1m base bounding box for furniture SVG placement
                    el.append('image')
                        .attr('href', `/${fType.svg_path}`)
                        .attr('x', -pxPerMeter)
                        .attr('y', -pxPerMeter)
                        .attr('width', pxPerMeter * 2)
                        .attr('height', pxPerMeter * 2)
                        .attr('class', 'opacity-80')
                        .style('pointer-events', 'none');
                        
                    // Interaction hit box
                    el.append('circle')
                        .attr('r', 20)
                        .attr('fill', isSelected ? 'rgba(59, 130, 246, 0.4)' : 'transparent')
                        .attr('stroke', isSelected ? '#3b82f6' : 'transparent')
                        .attr('stroke-width', 2)
                        .style('cursor', activeTool === 'move' ? 'move' : (activeTool === 'delete' ? 'pointer' : 'default'))
                        .style('pointer-events', 'all')
                        .on('click', (e) => {
                            e.stopPropagation();
                            if (activeTool === 'move') {
                                    setSelectedEntity({ id: tu.id, type: 'touchup' });
                            } else if (activeTool === 'delete') {
                                updateState({ touchups: touchups.filter(t => t.id !== tu.id) });
                            }
                        })
                        .on('mouseenter', function() {
                            if (activeTool === 'move' || activeTool === 'delete') {
                                d3.select(this).attr('fill', activeTool === 'delete' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.2)');
                            }
                        })
                        .on('mouseleave', function() {
                            d3.select(this).attr('fill', isSelected ? 'rgba(59, 130, 246, 0.4)' : 'transparent');
                        });
                }
            });
        }
        
        // 4.6 Annotation Layer
        {
            const annoGroup = g.append('g').attr('class', 'annotation-layer');
            const renderAnnotations = (annotations || []).filter((a: any) => !a.level_id || a.level_id === selectedFloor);

            renderAnnotations.forEach((a: any) => {
                const isSelected = selectedEntity?.id === a.id && selectedEntity?.type === 'annotation';
                const px = toPxX(a.x);
                const py = toPxY(a.y);

                if (a.kind === 'dimension') {
                    const x1 = toPxX(a.x1 ?? a.x);
                    const y1 = toPxY(a.y1 ?? a.y);
                    const x2 = toPxX(a.x2 ?? a.x);
                    const y2 = toPxY(a.y2 ?? a.y);
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

                    annoGroup.append('line')
                        .attr('x1', x1).attr('y1', y1)
                        .attr('x2', x2).attr('y2', y2)
                        .attr('stroke', isSelected ? '#3b82f6' : '#a1a1aa')
                        .attr('stroke-width', 1)
                        .attr('stroke-dasharray', '4,3');

                    // Ticks at ends
                    const nx = -(y2 - y1) / dist, ny = (x2 - x1) / dist;
                    const tickLen = 6;
                    for (const [ex, ey] of [[x1, y1], [x2, y2]]) {
                        annoGroup.append('line')
                            .attr('x1', ex - nx * tickLen).attr('y1', ey - ny * tickLen)
                            .attr('x2', ex + nx * tickLen).attr('y2', ey + ny * tickLen)
                            .attr('stroke', '#a1a1aa').attr('stroke-width', 1);
                    }

                    const label = a.text || `${((a.x2 !== undefined ? Math.abs(a.x2 - a.x1!) : Math.abs(a.y2! - a.y1!)) * 1).toFixed(2)}m`;
                    annoGroup.append('text')
                        .attr('x', midX).attr('y', midY - 4)
                        .attr('text-anchor', 'middle')
                        .attr('fill', isSelected ? '#3b82f6' : '#d4d4d8')
                        .attr('font-size', '11px')
                        .style('pointer-events', 'none')
                        .text(label);
                } else {
                    // text / label / arrow — all render as text at position
                    const color = isSelected ? '#3b82f6' : (a.kind === 'arrow' ? '#f59e0b' : '#d4d4d8');
                    const fontSize = a.kind === 'arrow' ? '10px' : '12px';

                    if (a.kind === 'arrow' && a.x1 != null && a.y1 != null) {
                        const ax = toPxX(a.x1), ay = toPxY(a.y1);
                        annoGroup.append('line')
                            .attr('x1', ax).attr('y1', ay)
                            .attr('x2', px).attr('y2', py)
                            .attr('stroke', color).attr('stroke-width', 1);
                        // arrowhead
                        const angle = Math.atan2(py - ay, px - ax);
                        const headLen = 8;
                        annoGroup.append('polygon')
                            .attr('points', [
                                [px, py].join(','),
                                [px - headLen * Math.cos(angle - 0.4), py - headLen * Math.sin(angle - 0.4)].join(','),
                                [px - headLen * Math.cos(angle + 0.4), py - headLen * Math.sin(angle + 0.4)].join(','),
                            ].join(' '))
                            .attr('fill', color);
                    }

                    annoGroup.append('text')
                        .attr('x', px + (a.kind === 'arrow' ? 6 : 0))
                        .attr('y', py + (a.kind === 'arrow' ? 4 : 0))
                        .attr('text-anchor', a.kind === 'arrow' ? 'start' : 'middle')
                        .attr('fill', color)
                        .attr('font-size', fontSize)
                        .style('pointer-events', 'none')
                        .text(a.text || (a.kind === 'arrow' ? '' : 'Text'));

                    // Clickable hit circle
                    annoGroup.append('circle')
                        .attr('cx', px).attr('cy', py)
                        .attr('r', 8)
                        .attr('fill', 'transparent')
                        .attr('stroke', isSelected ? '#3b82f6' : 'transparent')
                        .attr('stroke-width', 1)
                        .style('cursor', 'pointer')
                        .on('click', (e) => { e.stopPropagation(); setSelectedEntity({ id: a.id, type: 'annotation' }); });
                }
            });
        }

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

        // 6. Interactive Drawing Layer
        if (isEditMode && activeTool !== 'select') {
            const interactGroup = g.append('g').attr('class', 'interaction-layer');

            // Draw ghost preview for multi-node tools
            if (drawingSequence.length > 0 && mousePos) {
                const seqPx = drawingSequence.map(nid => {
                    const n = nodes.find(nn => nn.id === nid);
                    return n ? [toPxX(n.x), toPxY(n.y)] : null;
                }).filter(Boolean) as [number, number][];

                if (seqPx.length > 0) {
                    if (activeTool === 'add_arch_wall' || activeTool === 'add_beam') {
                        // Line from last clicked node to mouse
                        interactGroup.append('line')
                            .attr('x1', seqPx[0][0]).attr('y1', seqPx[0][1])
                            .attr('x2', mousePos.x).attr('y2', mousePos.y)
                            .attr('stroke', activeTool === 'add_beam' ? '#fbbf24' : '#6b7280')
                            .attr('stroke-width', activeTool === 'add_beam' ? 8 : 16)
                            .attr('stroke-dasharray', '5,5')
                            .attr('opacity', 0.5);
                    } else if (activeTool === 'add_room') {
                        // Polygon from clicked nodes + mouse
                        const pts = [...seqPx, [mousePos.x, mousePos.y]];
                        interactGroup.append('polygon')
                            .attr('points', pts.map(p => `${p[0]},${p[1]}`).join(' '))
                            .attr('fill', 'rgba(16, 185, 129, 0.2)')
                            .attr('stroke', '#10b981')
                            .attr('stroke-dasharray', '5,5')
                            .attr('stroke-width', 2);
                    }
                }
            }

            // Draw clickable nodes for snapping
            if (['add_column', 'add_beam', 'add_footing', 'add_arch_wall', 'add_room'].includes(activeTool)) {
                // Find node ID of the start of the sequence to color it differently
                const startNid = drawingSequence.length > 0 ? drawingSequence[0] : null;

                renderNodes.forEach(n => {
                    const px = toPxX(n.x);
                    const py = toPxY(n.y);
                    const isStart = n.id === startNid;
                    const isSequence = drawingSequence.includes(n.id);
                    
                    interactGroup.append('circle')
                        .attr('cx', px)
                        .attr('cy', py)
                        .attr('r', isStart ? 8 : 4)
                        .attr('fill', isStart ? '#10b981' : (isSequence ? '#3b82f6' : 'rgba(255,255,255,0.2)'))
                        .attr('stroke', isStart ? '#059669' : '#ffffff')
                        .attr('stroke-width', 2)
                        .style('cursor', 'crosshair')
                        .on('mouseenter', function() { d3.select(this).attr('r', 16).attr('fill', '#fcd34d'); })
                        .on('mouseleave', function() { d3.select(this).attr('r', isStart ? 8 : 4).attr('fill', isStart ? '#10b981' : (isSequence ? '#3b82f6' : 'rgba(255,255,255,0.2)')); })
                        .on('click', (e) => {
                            e.stopPropagation(); // prevent zooming/panning
                            
                            if (activeTool === 'add_column') {
                                const newId = `col_${Date.now()}`;
                                updateState({ elements: [...elements, { id: newId, type: 'column', n1: n.id, n2: n.id, b: 0.3, h: 0.3, level_id: selectedFloor }] });
                                setActiveTool('select');
                            } else if (activeTool === 'add_footing') {
                                const newId = `ftg_${Date.now()}`;
                                updateState({ elements: [...elements, { id: newId, type: 'footing', node_id: n.id, n1: n.id, level_id: selectedFloor }] });
                                setActiveTool('select');
                            } 
                            else if (activeTool === 'add_beam' || activeTool === 'add_arch_wall') {
                                if (drawingSequence.length === 0) {
                                    setDrawingSequence([n.id]);
                                } else if (drawingSequence.length === 1 && drawingSequence[0] !== n.id) {
                                    // Complete the segment
                                    const n1 = drawingSequence[0];
                                    const n2 = n.id;
                                    if (activeTool === 'add_beam') {
                                        const newId = `beam_${Date.now()}`;
                                        updateState({ elements: [...elements, { id: newId, type: 'beam', n1, n2, b: 0.2, h: 0.6, level_id: selectedFloor }] });
                                    } else {
                                        const newId = `aw_${Date.now()}`;
                                        const type_id = activeTypes?.wall || 'EXT_BRICK_200';
                                        updateState({ architecture: [...architecture, { id: newId, type: 'wall', n1, n2, type_id, level_id: selectedFloor }] });
                                    }
                                    setDrawingSequence([]); // reset for next
                                }
                            }
                            else if (activeTool === 'add_room') {
                                if (drawingSequence.length > 2 && n.id === drawingSequence[0]) {
                                    // Closed the polygon!
                                    const newId = `room_${Date.now()}`;
                                    const type_id = activeTypes?.room || 'LIVING_SPACE';
                                    const rType = type_id.includes('BED') ? 'bedroom' : type_id.includes('BATH') ? 'bathroom' : type_id.includes('KITCH') ? 'kitchen' : type_id.includes('STAIR') ? 'stair' : type_id.includes('CORRIDOR') ? 'corridor' : 'living';
                                    updateState({ rooms: [...rooms, { id: newId, type: rType, type_id, nodes: [...drawingSequence], level_id: selectedFloor }] });
                                    setDrawingSequence([]);
                                    setActiveTool('select');
                                } else if (!drawingSequence.includes(n.id)) {
                                    // Add node to sequence
                                    setDrawingSequence([...drawingSequence, n.id]);
                                }
                            }
                        });
                });
            }
            
            // Add SVG background mousemove for ghost lines
            svg.on('mousemove', (e) => {
                if (drawingSequence.length > 0 && currentZoomRef.current) {
                    const [mx, my] = d3.pointer(e, g.node());
                    setMousePos({ x: mx, y: my });
                }
            });
            
            svg.on('click', (e) => {
                const [mx, my] = d3.pointer(e, g.node());
                const mX = fromPxX(mx);
                const mY = fromPxY(my);

                if (activeTool === 'copy') {
                    const copyData = { nodes, elements, slabs, architecture, rooms, openings, levels: { architectural: [], structural: [] }, touchups, annotations, types: {}, project_info, settings };
                    const target = selectedEntity ?? findClosestEntity(copyData as any, mX, mY, 0.5);
                    if (target) {
                        const { state, newRef } = copyEntity(copyData as any, target, 1);
                        updateState(state);
                        setSelectedEntity(newRef);
                    }
                } else if (activeTool === 'add_arch_wall' || activeTool === 'add_beam' || activeTool === 'add_room' || activeTool === 'add_column' || activeTool === 'add_footing') {
                    const newNodeId = `node_${Date.now()}`;
                    const newNode = { id: newNodeId, x: Number(mX.toFixed(4)), y: Number(mY.toFixed(4)), z: 0 };

                    if (activeTool === 'add_column') {
                        updateState({
                            nodes: [...nodes, newNode],
                            elements: [...elements, { id: `col_${Date.now()}`, type: 'column', n1: newNodeId, n2: newNodeId, b: 0.3, h: 0.3, level_id: selectedFloor }]
                        });
                        setActiveTool('select');
                    } else if (activeTool === 'add_footing') {
                        updateState({
                            nodes: [...nodes, newNode],
                            elements: [...elements, { id: `ftg_${Date.now()}`, type: 'footing', node_id: newNodeId, n1: newNodeId, level_id: selectedFloor }]
                        });
                        setActiveTool('select');
                    } else if (activeTool === 'add_beam' || activeTool === 'add_arch_wall') {
                        if (drawingSequence.length === 0) {
                            updateState({ nodes: [...nodes, newNode] });
                            setDrawingSequence([newNodeId]);
                        } else if (drawingSequence.length === 1) {
                            const n1 = drawingSequence[0];
                            const n2 = newNodeId;
                            const allNodes = [...nodes, newNode];
                            if (activeTool === 'add_beam') {
                                updateState({
                                    nodes: allNodes,
                                    elements: [...elements, { id: `beam_${Date.now()}`, type: 'beam', n1, n2, b: 0.2, h: 0.6, level_id: selectedFloor }]
                                });
                            } else {
                                const type_id = activeTypes?.wall || 'EXT_BRICK_200';
                                updateState({
                                    nodes: allNodes,
                                    architecture: [...architecture, { id: `aw_${Date.now()}`, type: 'wall', n1, n2, type_id, level_id: selectedFloor }]
                                });
                            }
                            setDrawingSequence([]);
                        }
                    } else if (activeTool === 'add_room') {
                        updateState({ nodes: [...nodes, newNode] });
                        setDrawingSequence([...drawingSequence, newNodeId]);
                    }
                } else if (activeTool === 'add_text') {
                    const newId = `anno_${Date.now()}`;
                    updateState({
                        annotations: [...(annotations || []), { id: newId, kind: 'text', x: Number(mX.toFixed(3)), y: Number(mY.toFixed(3)), text: 'Text', level_id: selectedFloor }]
                    });
                    setActiveTool('select');
                } else if (activeTool === 'add_dimension') {
                    if (!dimensionStartRef.current) {
                        dimensionStartRef.current = { x: mX, y: mY };
                    } else {
                        const start = dimensionStartRef.current;
                        const newId = `anno_${Date.now()}`;
                        updateState({
                            annotations: [...(annotations || []), {
                                id: newId, kind: 'dimension',
                                x: Number(((start.x + mX) / 2).toFixed(3)),
                                y: Number(((start.y + mY) / 2).toFixed(3)),
                                x1: Number(start.x.toFixed(3)), y1: Number(start.y.toFixed(3)),
                                x2: Number(mX.toFixed(3)), y2: Number(mY.toFixed(3)),
                                text: `${Math.sqrt((mX - start.x) ** 2 + (mY - start.y) ** 2).toFixed(2)}m`,
                                level_id: selectedFloor
                            }]
                        });
                        dimensionStartRef.current = null;
                        setActiveTool('select');
                    }
                } else if (activeTool === 'add_touchup' && activeFurnitureId) {
                    const newId = `tu_${Date.now()}`;
                    updateState({
                        touchups: [...touchups, {
                            id: newId,
                            type_id: activeFurnitureId,
                            x: Number(mX.toFixed(2)),
                            y: Number(mY.toFixed(2)),
                            rotation: 0,
                            scale: 1,
                            level_id: selectedFloor
                        }]
                    });
                }
            });
        }

        } catch (err) {
            console.error("D3 Rendering Error:", err);
            svg.append('text').attr('x', 50).attr('y', 50).text('Render Error: ' + err).attr('fill', 'red');
        }
    }, [architecture, rooms, openings, nodes, elements, slabs, touchups, annotations, scope, localFloor, forcedFloor, activeTool, isPrintMode, types, bom, updateState, editingRoomId, selectedEntity, showAreaLabels, availableLevels, isEditMode]);

    return (
        <div className={`relative bg-zinc-950 rounded-xl overflow-hidden shadow-2xl border border-zinc-800 ${isFullScreen ? 'fixed inset-0 z-40 rounded-none' : 'w-full h-full'}`}>
            
            {/* Top Controls */}
            {!isPrintMode && (
                <div className="absolute top-4 left-4 flex gap-2 z-50">
                    <div className="bg-zinc-800/80 backdrop-blur rounded-lg p-1 border border-zinc-700 flex items-center shadow-lg">
                        <select 
                            value={selectedFloor}
                            onChange={(e) => setLocalFloor(e.target.value)}
                            className="bg-transparent text-white px-2 py-1 outline-none text-sm font-medium cursor-pointer"
                        >
                            {availableLevels.map((l: any) => (
                                <option key={l.id} value={l.id} className="bg-zinc-800">{l.name}</option>
                            ))}
                        </select>
                    </div>

                    {setIsEditMode && (
                        <div className="bg-zinc-800/80 backdrop-blur rounded-lg p-1 border border-zinc-700 flex items-center shadow-lg">
                            <button
                                onClick={() => setIsEditMode(false)}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${!isEditMode ? 'bg-zinc-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                View
                            </button>
                            <button
                                onClick={() => setIsEditMode(true)}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${isEditMode ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                Edit
                            </button>
                        </div>
                    )}
                </div>
            )}

            <button 
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="absolute top-4 right-4 p-2 bg-zinc-800/80 hover:bg-zinc-700 text-white rounded-lg backdrop-blur z-50 transition"
            >
                {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <svg ref={svgRef} className="w-full h-full cursor-move" viewBox="0 0 1200 800" />
            
            <FurnitureCatalogPanel isOpen={isCatalogOpen} setIsOpen={setIsCatalogOpen} activeFurniture={activeFurnitureId} setActiveFurniture={setActiveFurnitureId} />
            
            {/* Legend */}
            <div className="absolute bottom-6 left-6 bg-zinc-900/90 p-4 rounded-lg border border-zinc-700/50 backdrop-blur-md">
                <h3 className="text-zinc-200 text-sm font-semibold mb-3 uppercase tracking-wider">{scope} Legend</h3>
                <div className="space-y-2 text-sm text-zinc-400">
                    {scope === 'structural' && (
                        <>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded-sm"></div> Columns</div>
                            <div className="flex items-center gap-2"><div className="w-4 h-1 bg-amber-400"></div> Beams</div>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-violet-400 rounded-sm"></div> Footings</div>
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
