export const drawStructuralLabels = (
    g: any,
    elements: any[],
    nodes: any[],
    bom: any[],
    toPxX: (m: number) => number,
    toPxY: (m: number) => number,
    scope: string,
    isPrintMode: boolean
) => {
    if (scope !== 'structural') return;

    const getNode = (id: string | number) => nodes.find(n => n.id === id);
    const getBomItem = (id: string | number) => Array.isArray(bom) ? bom.find(b => b.id === id) : null;

    const calculateBeamSize = (n1: any, n2: any) => {
        if (!n1 || !n2) return '200x600';
        
        // Find all column nodes that lie on this beam
        const colsOnBeam = nodes.filter(n => {
            // Is it a column?
            const isCol = elements.some(e => e.type === 'column' && (e.n1 === n.id || e.n2 === n.id));
            if (!isCol) return false;
            
            // Does it lie on the line segment n1-n2?
            const d1 = Math.hypot(n.x - n1.x, n.y - n1.y);
            const d2 = Math.hypot(n2.x - n.x, n2.y - n.y);
            const d = Math.hypot(n2.x - n1.x, n2.y - n1.y);
            return Math.abs(d1 + d2 - d) < 0.1; // within 10cm of the line
        });
        
        // Sort nodes by distance from n1
        colsOnBeam.sort((a, b) => Math.hypot(a.x - n1.x, a.y - n1.y) - Math.hypot(b.x - n1.x, b.y - n1.y));
        
        let maxSpan = 0;
        for (let i = 0; i < colsOnBeam.length - 1; i++) {
            const span = Math.hypot(colsOnBeam[i+1].x - colsOnBeam[i].x, colsOnBeam[i+1].y - colsOnBeam[i].y);
            if (span > maxSpan) maxSpan = span;
        }
        
        // Fallback if no intermediate columns (or only 1 column found)
        if (maxSpan === 0 || maxSpan < 0.1) {
            maxSpan = Math.hypot(n2.x - n1.x, n2.y - n1.y);
        }
        
        const depth = Math.max(400, Math.ceil(maxSpan / 0.1) * 100); // Changed to *100 and min 400 for mm
        return `200x${depth}`;
    };

    const labelGroup = g.append('g').attr('class', 'structural-labels');

    elements.forEach((el) => {
        if (el.type === 'column') {
            const n1 = getNode(el.n1);
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
            const n1 = getNode(el.n1);
            const n2 = getNode(el.n2);
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
                // Fallback for single span
                const cx = toPxX((n1.x + n2.x) / 2);
                const cy = toPxY((n1.y + n2.y) / 2);
                
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
        }
    });
};
