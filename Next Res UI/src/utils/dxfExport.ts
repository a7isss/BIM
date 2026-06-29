import type { Node, Element, Slab } from '../types';

interface Point {
    x: number;
    y: number;
}

function dxfPoint(p: Point): string {
    return `10\n${p.x.toFixed(3)}\n20\n${p.y.toFixed(3)}\n30\n0.0`;
}

function dxfLine(p1: Point, p2: Point, layer: string): string {
    return `0\nLINE\n8\n${layer}\n` + dxfPoint(p1) + `\n11\n${p2.x.toFixed(3)}\n21\n${p2.y.toFixed(3)}\n31\n0.0`;
}

function dxfPolyline(points: Point[], layer: string, closed: boolean = true): string {
    if (points.length < 2) return '';
    let res = `0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n${closed ? 1 : 0}\n10\n0.0\n20\n0.0\n30\n0.0\n`;
    for (const p of points) {
        res += `0\nVERTEX\n8\n${layer}\n` + dxfPoint(p) + '\n';
    }
    res += `0\nSEQEND\n8\n${layer}\n`;
    return res;
}

function dxfRect(center: Point, sizeX: number, sizeY: number, layer: string): string {
    const p1 = { x: center.x - sizeX / 2, y: center.y - sizeY / 2 };
    const p2 = { x: center.x + sizeX / 2, y: center.y - sizeY / 2 };
    const p3 = { x: center.x + sizeX / 2, y: center.y + sizeY / 2 };
    const p4 = { x: center.x - sizeX / 2, y: center.y + sizeY / 2 };
    return dxfPolyline([p1, p2, p3, p4], layer, true);
}

export function generateProjectDxf(nodes: Node[], elements: Element[], slabs: Slab[]): string {
    const entityLines: string[] = [];

    // Layers mapped
    const COL_LAYER = 'S-COL';
    const BEAM_LAYER = 'S-BEAM';
    const SLAB_LAYER = 'S-SLAB';

    // Draw Slabs
    for (const slab of slabs) {
        if (!slab.nodes) continue;
        const slabNodes = slab.nodes.map((nid: string | number) => nodes.find(n => n.id === nid)).filter((n): n is Node => !!n);
        if (slabNodes.length > 2) {
            entityLines.push(dxfPolyline(slabNodes, SLAB_LAYER, true));
        }
    }

    // Draw Beams
    const beams = elements.filter(e => e.type === 'beam');
    for (const beam of beams) {
        const n1 = nodes.find(n => n.id === beam.n1);
        const n2 = nodes.find(n => n.id === beam.n2);
        if (n1 && n2) {
            entityLines.push(dxfLine(n1, n2, BEAM_LAYER));
        }
    }

    // Draw Columns (fixed generic size of 0.3m x 0.3m for DXF preview)
    const columns = elements.filter(e => e.type === 'column');
    const colNodes = new Set();
    columns.forEach(c => { colNodes.add(c.n1); colNodes.add(c.n2); });
    colNodes.forEach(nid => {
        const n = nodes.find(node => node.id === nid);
        if (n) {
            entityLines.push(dxfRect(n, 0.3, 0.3, COL_LAYER));
        }
    });

    const body = entityLines.join('\n');

    return `0\nSECTION\n2\nENTITIES\n${body}\n0\nENDSEC\n0\nEOF\n`;
}

export function downloadDxf(nodes: Node[], elements: Element[], slabs: Slab[], filename: string = 'resplan_export.dxf') {
    const dxfString = generateProjectDxf(nodes, elements, slabs);
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
