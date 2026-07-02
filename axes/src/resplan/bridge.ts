import type { ResPlanData, Opening, ArchitectureLine, Room } from './types';

/**
 * Translate the AXES activeLayout shape into ResPlan's ResPlanData shape.
 * AXES nodes use {position:{x,y}}; ResPlan nodes use {x,y,z}.
 * AXES links become ArchitectureLine walls.
 * AXES doors/windows become Openings.
 */
export function axesToResPlan(axesLayout: any): ResPlanData {
    if (!axesLayout) {
        return emptyResPlanData();
    }

    const axesNodes: any[] = axesLayout.nodes || [];
    const axesLinks: any[] = axesLayout.links || [];
    const axesRooms: any[] = axesLayout.rooms || [];
    const axesDoors: any[] = axesLayout.doors || [];
    const axesWindows: any[] = axesLayout.windows || [];

    // 1. Translate nodes: {id, position:{x,y}} → {id, x, y, z:0}
    const idMap = new Map<string, string | number>();
    const resplanNodes = axesNodes.map((n, i) => {
        const pos = n.position || n.centroid || { x: 0, y: 0 };
        const rid = typeof n.id === 'number' ? n.id : (n.id || `n_${i}`);
        idMap.set(String(n.id), rid);
        return { id: rid, x: pos.x, y: pos.y, z: 0 };
    });

    // 2. Translate links (type='room_wall') → ArchitectureLine walls
    const architecture: ArchitectureLine[] = [];
    const processedPairs = new Set<string>();
    axesLinks.forEach((link, i) => {
        if (link.type !== 'room_wall') return;
        const src = idMap.get(String(link.source));
        const tgt = idMap.get(String(link.target));
        if (src === undefined || tgt === undefined) return;
        const pair = [String(src), String(tgt)].sort().join('-');
        if (processedPairs.has(pair)) return;
        processedPairs.add(pair);
        architecture.push({
            id: `aw_${i}`,
            type: 'wall',
            n1: src,
            n2: tgt,
        });
    });

    // 3. Translate rooms: use wall_nodes[] or nodes[] mapping
    const resplanRooms: Room[] = [];
    (axesRooms || []).forEach((r: any, i) => {
        const rawNodes = r.wall_nodes || r.nodes || [];
        const mappedNodes = rawNodes
            .map((nid: any) => idMap.get(String(nid)))
            .filter((n: any) => n !== undefined);
        if (mappedNodes.length < 2) return;
        resplanRooms.push({
            id: r.id || `room_${i}`,
            type: r.type || 'living',
            type_id: r.type_id || r.type || 'LIVING_SPACE',
            nodes: mappedNodes,
        });
    });

    // 4. Translate doors → Openings (type='door')
    const openings: Opening[] = [];
    (axesDoors || []).forEach((d, i) => {
        const angleRad = ((d.rotation || 0) * Math.PI) / 180;
        let nx = 0, ny = 0;
        const side = (d.wallSide || 'north').toLowerCase();
        if (side === 'north') { nx = 0; ny = 1; }
        else if (side === 'south') { nx = 0; ny = -1; }
        else if (side === 'east') { nx = 1; ny = 0; }
        else if (side === 'west') { nx = -1; ny = 0; }
        // If no wallSide, derive from rotation
        if (!d.wallSide) {
            nx = Math.cos(angleRad);
            ny = Math.sin(angleRad);
        }
        openings.push({
            id: d.id || `door_${i}`,
            type: 'door',
            x: d.position?.x ?? 0,
            y: d.position?.y ?? 0,
            z: 0,
            angle: angleRad,
            width: d.width || 0.9,
            height: 2.1,
            nx: Number(nx.toFixed(2)),
            ny: Number(ny.toFixed(2)),
        });
    });

    // 5. Translate windows → Openings (type='window')
    (axesWindows || []).forEach((w, i) => {
        let nx = 0, ny = 0;
        const side = (w.wallSide || 'north').toLowerCase();
        if (side === 'north') { nx = 0; ny = 1; }
        else if (side === 'south') { nx = 0; ny = -1; }
        else if (side === 'east') { nx = 1; ny = 0; }
        else if (side === 'west') { nx = -1; ny = 0; }
        openings.push({
            id: w.id || `win_${i}`,
            type: 'window',
            x: w.position?.x ?? 0,
            y: w.position?.y ?? 0,
            z: 1.0,
            angle: ((w.rotation || 0) * Math.PI) / 180,
            width: w.width || 1.2,
            height: 1.2,
            nx: Number(nx.toFixed(2)),
            ny: Number(ny.toFixed(2)),
        });
    });

    // 6. Levels — create a basic ground level from site params / default
    const levels = {
        architectural: [
            { id: 'arch_ground', name: 'Ground Floor', elevation_m: 0, height_m: axesLayout.total_area_m2 ? 3.5 : 3.0 },
            { id: 'arch_first', name: 'First Floor', elevation_m: 3.5, height_m: 3.0 },
        ],
        structural: [
            { id: 'str_ground', name: 'Ground Level', elevation_m: 0, height_m: 0.3 },
            { id: 'str_first_story', name: 'First Story', elevation_m: 3.5, height_m: 3.0 },
        ],
    };

    // 7. Project info
    const w = axesLayout.width_m || 20;
    const h = axesLayout.height_m || 30;
    const project_info = {
        name: axesLayout.plan_name || 'Imported Plan',
        front_elevation_angle: 0,
        plot: {
            width_m: w,
            depth_m: h,
            setbacks_m: { front: 2, rear: 2, side1: 1.5, side2: 1.5 },
        },
    };

    return {
        nodes: resplanNodes,
        elements: [],
        slabs: [],
        architecture,
        rooms: resplanRooms,
        openings,
        levels,
        touchups: [],
        annotations: [],
        types: { doors: [], windows: [], walls: [], rooms: [], furniture: [] },
        project_info,
        settings: { floor_height_m: 3.0, parapet_height_m: 1.0 },
    };
}

function emptyResPlanData(): ResPlanData {
    return {
        nodes: [],
        elements: [],
        slabs: [],
        architecture: [],
        rooms: [],
        openings: [],
        levels: { architectural: [], structural: [] },
        touchups: [],
        annotations: [],
        types: { doors: [], windows: [], walls: [], rooms: [], furniture: [] },
        project_info: { name: 'New Project', front_elevation_angle: 0 },
        settings: { floor_height_m: 3.0, parapet_height_m: 1.0 },
    };
}
