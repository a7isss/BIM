import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useResPlanData } from '../hooks/useResPlanData';
import type { ArchitectureLine, Level, Opening } from '../types';

interface ElevationCanvasProps {
    elevationAngle: number;
}

const ElevationCanvas: React.FC<ElevationCanvasProps> = ({ elevationAngle }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const { architecture, openings, levels, types, settings } = useResPlanData();

    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        const width = 1200;
        const height = 800;
        svg.selectAll('*').remove();

        const g = svg.append('g');

        // Zoom & Pan
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 10])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        svg.call(zoom);

        // Calculate building center for panning
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        architecture.forEach((w: ArchitectureLine) => {
            if (w.type === 'wall' && w.coordinates) {
                w.coordinates.forEach((pt: [number, number]) => {
                    if (pt[0] < minX) minX = pt[0];
                    if (pt[0] > maxX) maxX = pt[0];
                    if (pt[1] < minY) minY = pt[1];
                    if (pt[1] > maxY) maxY = pt[1];
                });
            }
        });
        if (minX === Infinity) { minX = 0; maxX = 20; minY = 0; maxY = 20; }
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        const rad = (elevationAngle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Project 3D -> 2D
        const getScreenX = (x: number, y: number) => (x - cx) * cos + (y - cy) * sin;
        const getDepth = (x: number, y: number) => -(x - cx) * sin + (y - cy) * cos;

        const pxPerMeter = 60;
        
        // Initial transform to center it
        const initialTransform = d3.zoomIdentity.translate(width / 2, height - 100);
        svg.call(zoom.transform, initialTransform);

        const toPxX = (sx: number) => sx * pxPerMeter;
        const toPxY = (z: number) => -z * pxPerMeter; // Z up is Y down in SVG

        const archLevels = levels?.architectural || [];
        const levelElevations = new Map<string, number>();
        const levelHeights = new Map<string, number>();
        let maxElevation = -Infinity;
        let topLevelId: string | null = null;
        
        archLevels.forEach((l: Level) => {
            levelElevations.set(l.id, l.elevation_m);
            levelHeights.set(l.id, (l as any).height_m || settings?.floor_height_m || 3.5);
            if (l.elevation_m > maxElevation) {
                maxElevation = l.elevation_m;
                topLevelId = l.id;
            }
        });

        // 1. Draw Level Guides (back layer)
        const levelsGroup = g.append('g').attr('class', 'levels');
        archLevels.forEach((lvl: Level) => {
            const zPx = toPxY(lvl.elevation_m);
            levelsGroup.append('line')
                .attr('x1', -width * 2)
                .attr('x2', width * 2)
                .attr('y1', zPx)
                .attr('y2', zPx)
                .attr('stroke', '#52525b') // zinc-600
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '5,5');
            
            levelsGroup.append('text')
                .attr('x', width / 2 - 50)
                .attr('y', zPx - 5)
                .attr('fill', '#a1a1aa') // zinc-400
                .attr('font-size', '12px')
                .attr('text-anchor', 'end')
                .text(`${lvl.name} (+${lvl.elevation_m.toFixed(1)}m)`);
        });

        // Prepare Walls
        const drawItems: any[] = [];
        
        architecture.forEach((w: ArchitectureLine) => {
            if (w.type === 'wall' && w.coordinates && w.coordinates.length >= 2) {
                const z0 = (w.level_id && levelElevations.get(w.level_id)) || 0;
                let h = (w.level_id && levelHeights.get(w.level_id)) || settings?.floor_height_m || 3.5;
                
                // If it's the top-most level, assume it's a parapet wall
                if (w.level_id === topLevelId) {
                    h = settings?.parapet_height_m || 1.0; // Parapet height
                }
                
                const z1 = z0 + h;
                
                const p1 = w.coordinates[0];
                const p2 = w.coordinates[1];
                
                const sx1 = getScreenX(p1[0], p1[1]);
                const depth1 = getDepth(p1[0], p1[1]);
                
                const sx2 = getScreenX(p2[0], p2[1]);
                const depth2 = getDepth(p2[0], p2[1]);
                
                // If the wall is purely perpendicular to the screen, its width is 0. 
                // But we draw it as a line.
                const leftSx = Math.min(sx1, sx2);
                const rightSx = Math.max(sx1, sx2);
                const avgDepth = (depth1 + depth2) / 2;
                
                if (Math.abs(rightSx - leftSx) > 0.05) {
                    drawItems.push({
                        type: 'wall',
                        zIndex: avgDepth,
                        left: leftSx,
                        right: rightSx,
                        bottom: z0,
                        top: z1,
                        wallData: w
                    });
                }
            }
        });

        // Prepare Openings (Doors/Windows)
        openings.forEach((op: Opening) => {
            const z0 = op.z !== undefined ? op.z : ((op.level_id && levelElevations.get(op.level_id)) || 0);
            let h = op.height || 2.1;
            let w = op.width || 1.0;
            
            if ((op as any).type_id && types) {
                const arr = op.type === 'window' ? types.windows : types.doors;
                const t = arr?.find((t: any) => t.id === (op as any).type_id);
                if (t) {
                    if (t.height) h = t.height;
                    if (t.width) w = t.width;
                }
            }
            
            // The opening center
            const sx = getScreenX(op.x, op.y);
            const depth = getDepth(op.x, op.y);
            
            // To project the opening width, we must know its orientation. 
            // op.nx, op.ny is the normal. The tangent is (-ny, nx).
            const tx = -(op as any).ny;
            const ty = (op as any).nx;
            
            // Project tangent to screen
            const screenTx = getScreenX(op.x + tx * w / 2, op.y + ty * w / 2) - sx;
            const projectedWidth = Math.abs(screenTx) * 2;
            
            if (projectedWidth > 0.05) {
                drawItems.push({
                    type: op.type,
                    zIndex: depth - 0.01, // slightly closer than the wall to draw on top
                    left: sx - projectedWidth / 2,
                    right: sx + projectedWidth / 2,
                    bottom: z0,
                    top: z0 + h,
                    openingData: op
                });
            }
        });

        // Z-Sort: larger depth means further away (drawn first), smaller depth means closer (drawn last)
        drawItems.sort((a, b) => b.zIndex - a.zIndex);

        // 2. Draw Sorted Items
        const structGroup = g.append('g').attr('class', 'elevation-elements');
        
        drawItems.forEach(item => {
            const xPx = toPxX(item.left);
            const wPx = toPxX(item.right) - xPx;
            const yTopPx = toPxY(item.top);
            const yBotPx = toPxY(item.bottom);
            const hPx = yBotPx - yTopPx;
            
            if (item.type === 'wall') {
                structGroup.append('rect')
                    .attr('x', xPx)
                    .attr('y', yTopPx)
                    .attr('width', wPx)
                    .attr('height', hPx)
                    .attr('fill', '#e4e4e7') // zinc-200
                    .attr('stroke', '#52525b') // zinc-600
                    .attr('stroke-width', 1.5)
                    .attr('opacity', 0.95);
            } else if (item.type === 'window') {
                structGroup.append('rect')
                    .attr('x', xPx)
                    .attr('y', yTopPx)
                    .attr('width', wPx)
                    .attr('height', hPx)
                    .attr('fill', '#7dd3fc') // sky-300
                    .attr('stroke', '#0284c7') // sky-600
                    .attr('stroke-width', 1.5)
                    .attr('opacity', 0.9);
                    
                // Draw window frame cross
                structGroup.append('line')
                    .attr('x1', xPx)
                    .attr('y1', yTopPx + hPx / 2)
                    .attr('x2', xPx + wPx)
                    .attr('y2', yTopPx + hPx / 2)
                    .attr('stroke', '#0284c7')
                    .attr('stroke-width', 1);
                structGroup.append('line')
                    .attr('x1', xPx + wPx / 2)
                    .attr('y1', yTopPx)
                    .attr('x2', xPx + wPx / 2)
                    .attr('y2', yTopPx + hPx)
                    .attr('stroke', '#0284c7')
                    .attr('stroke-width', 1);
            } else if (item.type === 'door') {
                structGroup.append('rect')
                    .attr('x', xPx)
                    .attr('y', yTopPx)
                    .attr('width', wPx)
                    .attr('height', hPx)
                    .attr('fill', '#d4d4d8') // zinc-300
                    .attr('stroke', '#3f3f46') // zinc-700
                    .attr('stroke-width', 2);
            }
        });

    }, [architecture, openings, levels, elevationAngle, types]);

    return (
        <div className="relative rounded-xl overflow-hidden shadow-2xl border border-zinc-800 w-full h-full bg-zinc-900">
            <svg ref={svgRef} className="w-full h-full cursor-move" viewBox="0 0 1200 800" />
            
            <div className="absolute bottom-6 left-6 bg-zinc-800/90 p-4 rounded-lg border border-zinc-700/50 backdrop-blur-md">
                <h3 className="text-zinc-200 text-sm font-semibold mb-3 uppercase tracking-wider">Elevation Legend</h3>
                <div className="space-y-2 text-sm text-zinc-400">
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-zinc-200 border border-zinc-600 rounded-sm"></div>
                        <span>Wall</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-sky-300 border border-sky-600 rounded-sm relative">
                            <div className="absolute top-1/2 left-0 w-full h-px bg-sky-600"></div>
                            <div className="absolute top-0 left-1/2 w-px h-full bg-sky-600"></div>
                        </div>
                        <span>Window</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-zinc-300 border border-zinc-700 rounded-sm"></div>
                        <span>Door</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ElevationCanvas;
