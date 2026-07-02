import * as d3 from 'd3';
import { drawStructuralLabels } from './StructuralLabels';
import type { Node, Element, Slab, Scope } from '../types';
import type { EntityRef } from '../utils/entityOps';

export const drawStructure = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    renderSlabs: Slab[],
    renderElements: Element[],
    renderNodes: Node[],
    nodes: Node[],
    bom: any[],
    toPxX: (m: number) => number,
    toPxY: (m: number) => number,
    pxPerMeter: number,
    scope: Scope,
    isPrintMode: boolean,
    activeTool: string,
    elements: Element[],
    updateState: (state: any) => void,
    selectedEntity: EntityRef | null,
    setSelectedEntity: (ref: EntityRef | null) => void
) => {
    // 1. Draw Slabs (Polygons)
    renderSlabs.forEach(slab => {
        if (!slab.nodes) return;
        const slabNodes = slab.nodes.map((nid: string | number) => nodes.find(n => n.id === nid)).filter(Boolean);
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

    // 2. Draw Beams (structural scope only — beams are not architectural elements)
    if (scope === 'structural') {
        const beams = renderElements.filter(e => e.type === 'beam');
        beams.forEach(beam => {
            const n1 = renderNodes.find(n => n.id === beam.n1);
            const n2 = renderNodes.find(n => n.id === beam.n2);
            if (n1 && n2) {
                const x1 = toPxX(n1.x), y1 = toPxY(n1.y);
                const x2 = toPxX(n2.x), y2 = toPxY(n2.y);
                
                g.append('line')
                    .attr('x1', x1).attr('y1', y1)
                    .attr('x2', x2).attr('y2', y2)
                    .attr('stroke', '#fbbf24')
                    .attr('stroke-width', 8)
                    .attr('stroke-linecap', 'round')
                    .style('cursor', activeTool === 'delete' ? 'pointer' : 'default')
                    .on('click', (e: any) => {
                        if (activeTool === 'delete') {
                            e.stopPropagation();
                            updateState({ elements: elements.filter((el: any) => el.id !== beam.id) });
                        }
                    });

                // Effective span label at beam midpoint
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;

                const bomEntry = bom.find((b: any) => b.id === beam.id);
                const effSpan = bomEntry?.effective_span_m;
                const totalLen = bomEntry?.length_m ?? beam.length_m;

                const dx = x2 - x1, dy = y2 - y1;
                const len = Math.hypot(dx, dy) || 1;
                const nx = -dy / len * 14;
                const ny = dx / len * 14;

                const labelBg = g.append('g').attr('transform', `translate(${mx + nx}, ${my + ny})`);
                
                labelBg.append('rect')
                    .attr('x', -34).attr('y', -10)
                    .attr('width', 68).attr('height', 18)
                    .attr('fill', 'rgba(0,0,0,0.65)')
                    .attr('rx', 3);

                labelBg.append('text')
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('fill', effSpan && totalLen && effSpan < totalLen ? '#34d399' : '#fbbf24')
                    .attr('font-size', '10px')
                    .attr('font-family', 'monospace')
                    .attr('font-weight', 'bold')
                    .text(effSpan != null ? `Leff=${effSpan}m` : totalLen != null ? `L=${totalLen}m` : '');
            }
        });
    }

    // 3. Draw Columns (structural scope: red rects sized by b/h; architectural scope: skip)
    if (scope === 'structural') {
        const columns = renderElements.filter(e => e.type === 'column');
        columns.forEach(c => {
            const nid = c.node_id ?? c.n1;
            if (nid == null) return;
            const n = renderNodes.find((node: any) => node.id === nid);
            if (!n) return;

            const colW = (c.b ?? 0.3) * pxPerMeter;
            const colH = (c.h ?? 0.3) * pxPerMeter;

            g.append('rect')
                .attr('x', toPxX(n.x) - colW / 2)
                .attr('y', toPxY(n.y) - colH / 2)
                .attr('width', colW)
                .attr('height', colH)
                .attr('fill', '#ef4444')
                .attr('stroke', '#991b1b')
                .attr('stroke-width', 2)
                .style('cursor', activeTool === 'delete' || activeTool === 'rotate' || activeTool === 'move' ? 'pointer' : 'default')
                .on('click', (e: any) => {
                    e.stopPropagation();
                    if (activeTool === 'delete') {
                        updateState({ elements: elements.filter((el: any) => el.id !== c.id) });
                    } else if (activeTool === 'rotate') {
                        updateState({
                            elements: elements.map((el: any) =>
                                el.id === c.id ? { ...el, b: el.h, h: el.b } : el
                            )
                        });
                    } else if (activeTool === 'move') {
                        setSelectedEntity({ id: c.id, type: 'column' });
                    }
                });

            if (selectedEntity && selectedEntity.id === c.id) {
                g.append('rect')
                    .attr('x', toPxX(n.x) - colW / 2 - 5)
                    .attr('y', toPxY(n.y) - colH / 2 - 5)
                    .attr('width', colW + 10)
                    .attr('height', colH + 10)
                    .attr('fill', 'none')
                    .attr('stroke', '#eab308')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '4,4');
            }
        });
    }
    
    // 4. Draw Footings
    if (scope === 'structural') {
        const footings = renderElements.filter(e => e.type === 'footing');
        footings.forEach(ftg => {
            const nid = ftg.node_id ?? ftg.n1;
            if (nid == null) return;
            const n = renderNodes.find((node: any) => node.id === nid);
            if (!n) return;
            g.append('rect')
                .attr('x', toPxX(n.x) - 12)
                .attr('y', toPxY(n.y) - 12)
                .attr('width', 24)
                .attr('height', 24)
                .attr('fill', '#a78bfa')
                .attr('stroke', '#7c3aed')
                .attr('stroke-width', 2)
                .attr('rx', 3)
                .style('cursor', activeTool === 'delete' || activeTool === 'move' ? 'pointer' : 'default')
                .on('click', (e: any) => {
                    e.stopPropagation();
                    if (activeTool === 'delete') {
                        updateState({ elements: elements.filter((el: any) => el.id !== ftg.id) });
                    } else if (activeTool === 'move') {
                        setSelectedEntity({ id: ftg.id, type: 'footing' });
                    }
                });
            if (selectedEntity && selectedEntity.id === ftg.id) {
                g.append('rect')
                    .attr('x', toPxX(n.x) - 17)
                    .attr('y', toPxY(n.y) - 17)
                    .attr('width', 34)
                    .attr('height', 34)
                    .attr('fill', 'none')
                    .attr('stroke', '#eab308')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '4,4')
                    .attr('rx', 5);
            }
        });
    }

    // 5. Draw Structural Labels
    drawStructuralLabels(g, renderElements, renderNodes, bom, toPxX, toPxY, scope, isPrintMode);
};
