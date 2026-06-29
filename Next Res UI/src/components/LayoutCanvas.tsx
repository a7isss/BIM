import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useResPlanData } from '../hooks/useResPlanData';
import type { Scope } from './RightPanel';
import { Maximize2, Minimize2 } from 'lucide-react';

import EditToolbar from './EditToolbar';
import type { EditTool } from './EditToolbar';
import { drawStructuralLabels } from './StructuralLabels';
import { drawAxesAndDims } from './drawAxesAndDims';
import { drawArchitecture } from './drawArchitecture';
import { drawStructure } from './drawStructure';

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
                return s.nodes.some((nid: number) => zNodes.has(nid));
            });
            
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
            drawArchitecture(
                g, renderRooms, renderArch, renderOpenings, nodes, types,
                toPxX, toPxY, pxPerMeter, scope, activeTool, rooms, architecture, openings,
                updateState, editingRoomId, setEditingRoomId, archOpacity
            );
        }

        if (scope === 'structural' || scope === 'architectural') {
            drawStructure(
                g, renderSlabs, renderElements, renderNodes, nodes, bom,
                toPxX, toPxY, scope, isPrintMode || false
            );
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
