import * as d3 from 'd3';
import type { Opening } from '../types';

export const drawStairway = (
    archGroup: any,
    roomCoords: [number, number][],
    openings: Opening[],
    toPxX: (m: number) => number,
    toPxY: (m: number) => number,
    pxPerMeter: number
) => {
    if (roomCoords.length < 3) return;

    // Helper: distance from point P to segment AB
    const distToSegment = (p: [number, number], a: [number, number], b: [number, number]) => {
        const l2 = (a[0] - b[0])**2 + (a[1] - b[1])**2;
        if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
        let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = a[0] + t * (b[0] - a[0]);
        const projY = a[1] + t * (b[1] - a[1]);
        return Math.hypot(p[0] - projX, p[1] - projY);
    };

    // 1. Find the door on the boundary
    let doorOpening: Opening | null = null;
    let doorWallStart: [number, number] | null = null;
    let doorWallEnd: [number, number] | null = null;

    const doors = openings.filter(o => o.type === 'door' || o.type === 'front_door' || o.type === 'sliding_door');
    
    for (const door of doors) {
        const doorPos: [number, number] = [door.x, door.y];
        for (let i = 0; i < roomCoords.length; i++) {
            const a = roomCoords[i];
            const b = roomCoords[(i + 1) % roomCoords.length];
            if (distToSegment(doorPos, a, b) < 0.1) {
                doorOpening = door;
                doorWallStart = a;
                doorWallEnd = b;
                break;
            }
        }
        if (doorOpening) break;
    }

    // If no door found, we just pick the longest wall as the base
    if (!doorWallStart || !doorWallEnd) {
        let maxLen = -1;
        for (let i = 0; i < roomCoords.length; i++) {
            const a = roomCoords[i];
            const b = roomCoords[(i + 1) % roomCoords.length];
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (len > maxLen) {
                maxLen = len;
                doorWallStart = a;
                doorWallEnd = b;
            }
        }
    }

    if (!doorWallStart || !doorWallEnd) return;

    // 2. Calculate inward normal
    const vx = doorWallEnd[0] - doorWallStart[0];
    const vy = doorWallEnd[1] - doorWallStart[1];
    const len = Math.hypot(vx, vy);
    const px = vx / len;
    const py = vy / len;
    
    let nx = -py;
    let ny = px;

    const midX = (doorWallStart[0] + doorWallEnd[0]) / 2;
    const midY = (doorWallStart[1] + doorWallEnd[1]) / 2;
    
    // Test point slightly along normal
    const test1X = midX + nx * 0.1;
    const test1Y = midY + ny * 0.1;
    
    // Ensure the normal points inside the polygon
    if (!d3.polygonContains(roomCoords, [test1X, test1Y])) {
        nx = py;
        ny = -px;
    }

    // 3. Project polygon vertices onto the normal to find depth
    let maxD = 0;
    for (const pt of roomCoords) {
        const d = (pt[0] - doorWallStart[0]) * nx + (pt[1] - doorWallStart[1]) * ny;
        if (d > maxD) maxD = d;
    }

    // 4. Generate step lines
    const LANDING_DEPTH = 1.2; // 1.2 meters landing space near the door
    const TREAD_DEPTH = 0.28; // standard 28cm stair tread depth

    const stairGroup = archGroup.append('g').attr('class', 'stairway-lines').style('pointer-events', 'none');

    let firstMidpoint: [number, number] | null = null;
    let lastMidpoint: [number, number] | null = null;

    for (let d = LANDING_DEPTH; d < maxD - LANDING_DEPTH; d += TREAD_DEPTH) {
        // Intersect the line `dot(X - A, N) = d` with all polygon edges
        const intersections: [number, number][] = [];
        
        for (let i = 0; i < roomCoords.length; i++) {
            const C = roomCoords[i];
            const D = roomCoords[(i + 1) % roomCoords.length];
            
            const dotC = (C[0] - doorWallStart[0]) * nx + (C[1] - doorWallStart[1]) * ny;
            const dotD = (D[0] - doorWallStart[0]) * nx + (D[1] - doorWallStart[1]) * ny;
            const denom = dotD - dotC;
            
            if (Math.abs(denom) > 1e-6) {
                const t = (d - dotC) / denom;
                // If the intersection is within the segment (with slight tolerance to avoid vertex duplication)
                if (t >= 0 && t < 1) {
                    intersections.push([
                        C[0] + t * (D[0] - C[0]),
                        C[1] + t * (D[1] - C[1])
                    ]);
                }
            }
        }
        
        // Sort intersections along the parallel vector P
        intersections.sort((a, b) => {
            const projA = (a[0] - doorWallStart[0]) * px + (a[1] - doorWallStart[1]) * py;
            const projB = (b[0] - doorWallStart[0]) * px + (b[1] - doorWallStart[1]) * py;
            return projA - projB;
        });
        
        // Draw segments between pairs of intersections
        for (let i = 0; i < intersections.length - 1; i += 2) {
            const p1 = intersections[i];
            const p2 = intersections[i + 1];
            
            if (i === 0) {
                const mid: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
                if (!firstMidpoint) firstMidpoint = mid;
                lastMidpoint = mid;
            }
            
            stairGroup.append('line')
                .attr('x1', toPxX(p1[0]))
                .attr('y1', toPxY(p1[1]))
                .attr('x2', toPxX(p2[0]))
                .attr('y2', toPxY(p2[1]))
                .attr('stroke', '#71717a') // zinc-500
                .attr('stroke-width', 1)
                .attr('stroke-linecap', 'butt');
        }
    }
    
    // Draw the central perpendicular line
    if (firstMidpoint && lastMidpoint) {
        stairGroup.append('line')
            .attr('x1', toPxX(firstMidpoint[0]))
            .attr('y1', toPxY(firstMidpoint[1]))
            .attr('x2', toPxX(lastMidpoint[0]))
            .attr('y2', toPxY(lastMidpoint[1]))
            .attr('stroke', '#71717a')
            .attr('stroke-width', 4)
            .attr('stroke-linecap', 'butt');
    }
};
