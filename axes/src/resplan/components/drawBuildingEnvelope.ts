import * as d3 from 'd3';
import type { Node, ArchitectureLine } from '../types';

export const drawBuildingEnvelope = (
    archGroup: any,
    renderArch: ArchitectureLine[],
    nodes: Node[],
    types: any,
    toPxX: (m: number) => number,
    toPxY: (m: number) => number,
    pxPerMeter: number
) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    renderArch.forEach((item: any) => {
        if (item.type === 'wall' && item.n1 && item.n2) {
            const n1 = nodes.find((n:any) => n.id === item.n1);
            const n2 = nodes.find((n:any) => n.id === item.n2);
            if (n1 && n2) {
                const wType = types?.walls?.find((w: any) => w.id === item.type_id);
                const thickness = wType ? wType.thickness : 0.2;
                const halfT = thickness / 2;

                const dx = n2.x - n1.x;
                const dy = n2.y - n1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                
                if (len > 0) {
                    const nx = -dy / len;
                    const ny = dx / len;
                    
                    const corners = [
                        [n1.x + nx * halfT, n1.y + ny * halfT],
                        [n1.x - nx * halfT, n1.y - ny * halfT],
                        [n2.x + nx * halfT, n2.y + ny * halfT],
                        [n2.x - nx * halfT, n2.y - ny * halfT]
                    ];
                    
                    corners.forEach((c: any) => {
                        if (c[0] < minX) minX = c[0];
                        if (c[0] > maxX) maxX = c[0];
                        if (c[1] < minY) minY = c[1];
                        if (c[1] > maxY) maxY = c[1];
                    });
                } else {
                    const coords = [[n1.x, n1.y], [n2.x, n2.y]];
                    coords.forEach((c: any) => {
                        if (c[0] < minX) minX = c[0];
                        if (c[0] > maxX) maxX = c[0];
                        if (c[1] < minY) minY = c[1];
                        if (c[1] > maxY) maxY = c[1];
                    });
                }
            }
        }
    });

    if (minX !== Infinity) {
        return { minX, maxX, minY, maxY };
    }
    
    return null;
};
