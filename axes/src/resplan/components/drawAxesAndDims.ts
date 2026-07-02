import * as d3 from 'd3';
import type { Node, Element } from '../types';

export const drawAxesAndDims = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodes: Node[],
    elements: Element[],
    toPxX: (m: number) => number,
    toPxY: (m: number) => number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
) => {
    // 1. Extract Column Nodes
    const colElements = elements.filter(el => el.type === 'column');
    const colNodeIds = new Set(colElements.map(c => c.n1));
    const colNodes = nodes.filter(n => colNodeIds.has(n.id));

    if (colNodes.length === 0) return;

    // 2. Group Unique X and Y coordinates (tolerance 0.1m)
    const uniqueXs: number[] = [];
    const uniqueYs: number[] = [];

    colNodes.forEach(node => {
        if (!uniqueXs.some(x => Math.abs(x - node.x) < 0.1)) {
            uniqueXs.push(node.x);
        }
        if (!uniqueYs.some(y => Math.abs(y - node.y) < 0.1)) {
            uniqueYs.push(node.y);
        }
    });

    uniqueXs.sort((a, b) => a - b);
    uniqueYs.sort((a, b) => b - a); // Y axis goes down on screen, but actual coordinates might be standard cartesian. We sort descending so top is first (A, B, C...)

    const pxPerMeter = 100;
    const padding = 6 * pxPerMeter; // Extensions past the building (6m to clear plot boundary and fence)

    const startX = toPxX(minX) - padding;
    const endX = toPxX(maxX) + padding;
    const startY = toPxY(maxY) - padding; // Top of screen
    const endY = toPxY(minY) + padding; // Bottom of screen

    const axesGroup = g.append('g').attr('class', 'structural-axes');

    // Define tick size for dimensions
    const tickSize = 10;
    const dimOffset = -80; // Negative value moves it closer to the plan (avoiding bubbles)

    // 3. Draw Vertical Axes (X-Grid)
    uniqueXs.forEach((x, index) => {
        const px = toPxX(x);
        const label = (index + 1).toString();

        // Grid Line
        axesGroup.append('line')
            .attr('x1', px)
            .attr('y1', startY)
            .attr('x2', px)
            .attr('y2', endY)
            .attr('stroke', '#9ca3af')
            .attr('stroke-dasharray', '15,10,5,10')
            .attr('stroke-width', 1.5);

        // Bottom Bubble
        axesGroup.append('circle')
            .attr('cx', px)
            .attr('cy', endY + 40)
            .attr('r', 32)
            .attr('fill', '#ffffff')
            .attr('stroke', '#4b5563')
            .attr('stroke-width', 2);

        axesGroup.append('text')
            .attr('x', px)
            .attr('y', endY + 40)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', '#1f2937')
            .attr('font-size', '28px')
            .attr('font-weight', 'bold')
            .text(label);
            
        // Top Bubble
        axesGroup.append('circle')
            .attr('cx', px)
            .attr('cy', startY - 40)
            .attr('r', 32)
            .attr('fill', '#ffffff')
            .attr('stroke', '#4b5563')
            .attr('stroke-width', 2);

        axesGroup.append('text')
            .attr('x', px)
            .attr('y', startY - 40)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', '#1f2937')
            .attr('font-size', '28px')
            .attr('font-weight', 'bold')
            .text(label);
    });

    // 4. Draw Horizontal Axes (Y-Grid)
    uniqueYs.forEach((y, index) => {
        const py = toPxY(y);
        const label = String.fromCharCode(65 + index); // A, B, C...

        // Grid Line
        axesGroup.append('line')
            .attr('x1', startX)
            .attr('y1', py)
            .attr('x2', endX)
            .attr('y2', py)
            .attr('stroke', '#9ca3af')
            .attr('stroke-dasharray', '15,10,5,10')
            .attr('stroke-width', 1.5);

        // Left Bubble
        axesGroup.append('circle')
            .attr('cx', startX - 40)
            .attr('cy', py)
            .attr('r', 32)
            .attr('fill', '#ffffff')
            .attr('stroke', '#4b5563')
            .attr('stroke-width', 2);

        axesGroup.append('text')
            .attr('x', startX - 40)
            .attr('y', py)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', '#1f2937')
            .attr('font-size', '28px')
            .attr('font-weight', 'bold')
            .text(label);
            
        // Right Bubble
        axesGroup.append('circle')
            .attr('cx', endX + 40)
            .attr('cy', py)
            .attr('r', 32)
            .attr('fill', '#ffffff')
            .attr('stroke', '#4b5563')
            .attr('stroke-width', 2);

        axesGroup.append('text')
            .attr('x', endX + 40)
            .attr('y', py)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', '#1f2937')
            .attr('font-size', '28px')
            .attr('font-weight', 'bold')
            .text(label);
    });

    // 5. Draw Dimensions (Dims)
    const dimsGroup = g.append('g').attr('class', 'structural-dims');

    // Horizontal dimensions (Bottom)
    const dimY = endY + dimOffset;
    
    // Draw continuous dimension baseline
    if (uniqueXs.length > 1) {
        dimsGroup.append('line')
            .attr('x1', toPxX(uniqueXs[0]))
            .attr('y1', dimY)
            .attr('x2', toPxX(uniqueXs[uniqueXs.length - 1]))
            .attr('y2', dimY)
            .attr('stroke', '#1f2937')
            .attr('stroke-width', 1);
            
        // First tick
        dimsGroup.append('line')
            .attr('x1', toPxX(uniqueXs[0]) - tickSize)
            .attr('y1', dimY + tickSize)
            .attr('x2', toPxX(uniqueXs[0]) + tickSize)
            .attr('y2', dimY - tickSize)
            .attr('stroke', '#1f2937')
            .attr('stroke-width', 2);
    }

    for (let i = 0; i < uniqueXs.length - 1; i++) {
        const x1 = uniqueXs[i];
        const x2 = uniqueXs[i + 1];
        const px1 = toPxX(x1);
        const px2 = toPxX(x2);
        
        // Distance in mm
        const distMm = Math.round(Math.abs(x2 - x1) * 1000);

        // Tick mark at end of span
        dimsGroup.append('line')
            .attr('x1', px2 - tickSize)
            .attr('y1', dimY + tickSize)
            .attr('x2', px2 + tickSize)
            .attr('y2', dimY - tickSize)
            .attr('stroke', '#1f2937')
            .attr('stroke-width', 2);

        // Text
        dimsGroup.append('text')
            .attr('x', (px1 + px2) / 2)
            .attr('y', dimY - 8)
            .attr('text-anchor', 'middle')
            .attr('fill', '#1f2937')
            .attr('font-size', '16px')
            .attr('font-weight', '500')
            .text(`${distMm}`); // Millimeters
    }

    // Vertical dimensions (Left)
    const dimX = startX - dimOffset;
    
    // Draw continuous dimension baseline
    if (uniqueYs.length > 1) {
        dimsGroup.append('line')
            .attr('x1', dimX)
            .attr('y1', toPxY(uniqueYs[0]))
            .attr('x2', dimX)
            .attr('y2', toPxY(uniqueYs[uniqueYs.length - 1]))
            .attr('stroke', '#1f2937')
            .attr('stroke-width', 1);
            
        // First tick
        dimsGroup.append('line')
            .attr('x1', dimX - tickSize)
            .attr('y1', toPxY(uniqueYs[0]) + tickSize)
            .attr('x2', dimX + tickSize)
            .attr('y2', toPxY(uniqueYs[0]) - tickSize)
            .attr('stroke', '#1f2937')
            .attr('stroke-width', 2);
    }

    for (let i = 0; i < uniqueYs.length - 1; i++) {
        const y1 = uniqueYs[i];
        const y2 = uniqueYs[i + 1];
        const py1 = toPxY(y1);
        const py2 = toPxY(y2);
        
        // Distance in mm
        const distMm = Math.round(Math.abs(y1 - y2) * 1000);

        // Tick mark at end of span
        dimsGroup.append('line')
            .attr('x1', dimX - tickSize)
            .attr('y1', py2 + tickSize)
            .attr('x2', dimX + tickSize)
            .attr('y2', py2 - tickSize)
            .attr('stroke', '#1f2937')
            .attr('stroke-width', 2);

        // Text rotated
        dimsGroup.append('text')
            .attr('x', dimX - 8)
            .attr('y', (py1 + py2) / 2)
            .attr('text-anchor', 'middle')
            .attr('fill', '#1f2937')
            .attr('font-size', '16px')
            .attr('font-weight', '500')
            .attr('transform', `rotate(-90, ${dimX - 8}, ${(py1 + py2) / 2})`)
            .text(`${distMm}`); // Millimeters
    }
};
