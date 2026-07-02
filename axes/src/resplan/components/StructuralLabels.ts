import * as d3 from 'd3';
import type { Node, Element, Scope } from '../types';

export const drawStructuralLabels = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    elements: Element[],
    nodes: Node[],
    bom: any[],
    toPxX: (m: number) => number,
    toPxY: (m: number) => number,
    scope: Scope,
    isPrintMode: boolean
) => {
    if (scope !== 'structural') return;

    const getNode = (id: string | number) => nodes.find(n => n.id === id);
    const getBomItem = (id: string | number) => Array.isArray(bom) ? bom.find(b => b.id === id) : null;
    const labelGroup = g.append('g').attr('class', 'structural-labels');

    elements.forEach((el) => {
        if (el.type === 'column') {
            const nid = el.node_id ?? el.n1;
            if (nid == null) return;
            const n1 = getNode(nid);
            if (!n1) return;
            
            const cx = toPxX(n1.x);
            const cy = toPxY(n1.y);
            
            const bomItem = getBomItem(el.id);
            const labelText = bomItem ? `${bomItem.design_label} [${bomItem.section}]` : `C[?]`;
            
            labelGroup.append('text')
                .attr('x', cx + 20)
                .attr('y', cy - 20)
                .attr('fill', '#ef4444')
                .attr('font-size', '14px')
                .attr('font-weight', 'bold')
                .attr('font-family', 'monospace')
                .text(labelText);
                
        } else if (el.type === 'beam') {
            if (el.n1 === undefined || el.n2 === undefined) return;
            const n1 = nodes.find(n => n.id === el.n1);
            const n2 = nodes.find(n => n.id === el.n2);
            if (!n1 || !n2) return;
            
            const cx = toPxX((n1.x + n2.x) / 2);
            const cy = toPxY((n1.y + n2.y) / 2);
            
            // Calculate angle for text rotation to align with beam
            const dx = toPxX(n2.x) - toPxX(n1.x);
            const dy = toPxY(n2.y) - toPxY(n1.y);
            let angle = Math.atan2(dy, dx) * (180 / Math.PI);
            
            // Keep text upright
            if (angle > 90 || angle < -90) {
                angle += 180;
            }
            
            const bomItem = getBomItem(el.id);
            const labelText = bomItem ? `${bomItem.design_label} [${bomItem.section}]` : `B[?]`;
            
            // If it's a continuous beam with intermediate columns, draw label on each span
            const colsOnBeam = nodes.filter(n => {
                const isCol = elements.some(e => e.type === 'column' && (e.n1 === n.id || e.n2 === n.id));
                if (!isCol) return false;
                const d1 = Math.hypot(n.x - n1.x, n.y - n1.y);
                const d2 = Math.hypot(n2.x - n.x, n2.y - n.y);
                const d = Math.hypot(n2.x - n1.x, n2.y - n1.y);
                return Math.abs(d1 + d2 - d) < 0.1;
            });
            
            colsOnBeam.sort((a, b) => Math.hypot(a.x - n1.x, a.y - n1.y) - Math.hypot(b.x - n1.x, b.y - n1.y));
            
            if (colsOnBeam.length >= 2) {
                for (let i = 0; i < colsOnBeam.length - 1; i++) {
                    const spanN1 = colsOnBeam[i];
                    const spanN2 = colsOnBeam[i+1];
                    const spanCx = toPxX((spanN1.x + spanN2.x) / 2);
                    const spanCy = toPxY((spanN1.y + spanN2.y) / 2);
                    
                    labelGroup.append('text')
                        .attr('x', spanCx)
                        .attr('y', spanCy - 10)
                        .attr('text-anchor', 'middle')
                        .attr('fill', '#fbbf24')
                        .attr('font-size', '14px')
                        .attr('font-weight', 'bold')
                        .attr('font-family', 'monospace')
                        .attr('transform', `rotate(${angle}, ${spanCx}, ${spanCy})`)
                        .style('text-shadow', isPrintMode ? 'none' : '1px 1px 2px #000000')
                        .text(labelText);
                }
            } else {
                labelGroup.append('text')
                    .attr('x', cx)
                    .attr('y', cy - 10)
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#fbbf24')
                    .attr('font-size', '14px')
                    .attr('font-weight', 'bold')
                    .attr('font-family', 'monospace')
                    .attr('transform', `rotate(${angle}, ${cx}, ${cy})`)
                    .style('text-shadow', isPrintMode ? 'none' : '1px 1px 2px #000000')
                    .text(labelText);
            }
        } else if (el.type === 'footing') {
            const nid = el.node_id ?? el.n1;
            if (nid == null) return;
            const n = getNode(nid);
            if (!n) return;
            
            const cx = toPxX(n.x);
            const cy = toPxY(n.y);
            
            const bomItem = getBomItem(el.id);
            const labelText = bomItem ? `${bomItem.design_label} [${bomItem.section}]` : `F[?]`;
            
            labelGroup.append('text')
                .attr('x', cx + 18)
                .attr('y', cy + 18)
                .attr('fill', '#a78bfa')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .attr('font-family', 'monospace')
                .text(labelText);
        }
    });
};
