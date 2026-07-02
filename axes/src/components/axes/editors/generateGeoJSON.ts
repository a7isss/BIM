import { Node, Door, Window, Stair } from '../../../store/useAxesStore';

/**
 * generateGeoJSON
 * 
 * Takes the 'Simple JSON' Source of Truth (nodes, links, doors, windows, stairs)
 * and generates a valid FeatureCollection-like GeoJSON payload compatible with
 * the existing Three.js/R3F extrusion logic.
 * 
 * If an originalGeojson is provided, this could be extended to translate the 
 * existing complex polygons. For now, it reconstructs clean 2D rectilinear 
 * representations of the nodes so that LLM/User modifications immediately reflect.
 */
export function generateGeoJSON(
    nodes: Node[],
    links: { source: string; target: string; type?: string }[],
    doors: Door[],
    windows: Window[],
    stairs: Stair[],
    wallWidth: number = 0.2,
    rooms?: any[],
    originalGeojson?: any
): any {
    const categories: Record<string, any> = {
        wall: { type: 'MultiLineString', coordinates: [] },
        wall_3d: { type: 'MultiPolygon', coordinates: [] },
        stair: { type: 'MultiPolygon', coordinates: [] },
        door: { type: 'MultiPolygon', coordinates: [] },
        window: { type: 'MultiPolygon', coordinates: [] },
        front_door: { type: 'MultiPolygon', coordinates: [] },
    };

    let minGlobalX = Infinity, minGlobalY = Infinity, maxGlobalX = -Infinity, maxGlobalY = -Infinity;

    // Helper: Creates a GeoJSON Ring (closed polygon) for a given box
    const createBoxRing = (x: number, y: number, w: number, h: number, rotationDeg: number = 0) => {
        const hw = w / 2;
        const hh = h / 2;
        const pts = [
            [-hw, -hh],
            [hw, -hh],
            [hw, hh],
            [-hw, hh],
            [-hw, -hh]
        ];

        const rad = (rotationDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        return pts.map(([px, py]) => [
            x + (px * cos - py * sin),
            y + (px * sin + py * cos)
        ]);
    };

    // Helper: Creates a GeoJSON Ring for an approximated circle (octagon)
    const createCircleRing = (x: number, y: number, radius: number) => {
        const pts = [];
        const segments = 8;
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            pts.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius]);
        }
        return pts;
    };

    // Helper: Update global bounds
    const updateBounds = (x: number, y: number) => {
        if (x < minGlobalX) minGlobalX = x;
        if (x > maxGlobalX) maxGlobalX = x;
        if (y < minGlobalY) minGlobalY = y;
        if (y > maxGlobalY) maxGlobalY = y;
    };

    // Create a node map for quick lookup
    const nodeMap = new Map<string, Node>();
    nodes.forEach(n => {
        nodeMap.set(n.id, n);
        const pos = n.position || n.centroid;
        if (pos) {
            updateBounds(pos.x, pos.y);
        }
    });

    // 1. Generate Walls
    // If the original Engine GeoJSON for walls exists, use it natively for 100% aesthetic match!
    if (originalGeojson?.categories?.wall) {
        categories.wall = {
            type: originalGeojson.categories.wall.type || 'MultiPolygon',
            coordinates: originalGeojson.categories.wall.coordinates
        };
    } else {
        // Fallback: build wall lines dynamically from links
        links.forEach(link => {
            const n1 = nodeMap.get(link.source);
            const n2 = nodeMap.get(link.target);
            if (!n1 || !n2) return;

            const p1 = n1.position || n1.centroid;
            const p2 = n2.position || n2.centroid;
            if (!p1 || !p2) return;

            // Add 2D wall line
            categories.wall.coordinates.push([[p1.x, p1.y], [p2.x, p2.y]]);
        });
    }

    // Always build 3D wall polygon layer dynamically from links so dragging walls works in 3D too
    links.forEach(link => {
        const n1 = nodeMap.get(link.source);
        const n2 = nodeMap.get(link.target);
        if (!n1 || !n2) return;

        const p1 = n1.position || n1.centroid;
        const p2 = n2.position || n2.centroid;
        if (!p1 || !p2) return;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        // Midpoint
        const cx = (p1.x + p2.x) / 2;
        const cy = (p1.y + p2.y) / 2;

        // Angle
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Add 3D wall polygon
        categories.wall_3d.coordinates.push([createBoxRing(cx, cy, length, wallWidth, angle)]);
    });

    // 1.5 Generate Wall Joints (Caps) to make corners perfectly smooth in 3D
    nodes.filter(n => n.type === 'wall_node').forEach(node => {
        const pos = node.position || node.centroid;
        if (pos) {
            categories.wall_3d.coordinates.push([createCircleRing(pos.x, pos.y, wallWidth / 2)]);
        }
    });

    // 2. Generate Rooms
    // Check if this is legacy data (nodes are room-type, not wall_node), OR we have original GeoJSON engine data
    const hasOriginalCategories = originalGeojson?.categories && Object.keys(originalGeojson.categories).length > 0;

    if (hasOriginalCategories) {
        // Legacy mode / High-Fidelity mode: Preserve original room polygons from GeoJSON engine
        // This maintains the exact complex, irregular room shapes from the database
        const roomTypes = ['living', 'bedroom', 'bathroom', 'kitchen', 'balcony', 'dining', 'study', 'majlis', 'garage'];
        roomTypes.forEach(type => {
            if (originalGeojson.categories[type]) {
                categories[type] = {
                    type: originalGeojson.categories[type].type || 'MultiPolygon',
                    coordinates: originalGeojson.categories[type].coordinates
                };
            }
        });
    } else if (rooms && rooms.length > 0) {
        // Rebuild from dynamic interactive graph points
        rooms.forEach((room: any) => {
            const type = room.type.toLowerCase();
            if (!categories[type]) {
                categories[type] = { type: 'MultiPolygon', coordinates: [] };
            }
            if (room.wall_nodes && room.wall_nodes.length >= 3) {
                const ring = room.wall_nodes.map((nid: string) => {
                    const n = nodeMap.get(nid);
                    const pos = n?.position || n?.centroid || { x: 0, y: 0 };
                    return [pos.x, pos.y];
                });
                // Close the ring
                if (ring.length > 0) {
                    ring.push([...ring[0]]);
                    categories[type].coordinates.push([ring]);
                }
            }
        });
    } else {
        // Fallback: If no rooms array is provided, maybe nodes represent rooms? (Lowest fidelity fallback)
        nodes.forEach(node => {
            if (node.type === 'wall_node' || node.type === 'stair') return;
            const type = node.type.toLowerCase();
            if (!categories[type]) {
                categories[type] = { type: 'MultiPolygon', coordinates: [] };
            }
            const pos = node.position || node.centroid || { x: 0, y: 0 };
            const w = node.dimensions?.width || Math.sqrt(node.area || 9);
            const h = node.dimensions?.height || Math.sqrt(node.area || 9);
            categories[type].coordinates.push([createBoxRing(pos.x, pos.y, w, h)]);
        });
    }

    // 3. Generate Doors
    // Always preserve original door polygons from GeoJSON if new edits don't exist
    if (doors.length === 0 && originalGeojson?.categories?.door) {
        categories.door = {
            type: originalGeojson.categories.door.type || 'MultiPolygon',
            coordinates: originalGeojson.categories.door.coordinates
        };
    } else {
        doors.forEach(door => {
            const depth = wallWidth + 0.1;
            const ww = (door.rotation === 90 || door.rotation === 270) ? depth : door.width;
            const wh = (door.rotation === 90 || door.rotation === 270) ? door.width : depth;
            categories.door.coordinates.push([createBoxRing(door.position.x, door.position.y, ww, wh)]);
        });
    }

    // 4. Generate Windows
    // Always preserve original window polygons from GeoJSON if new edits don't exist
    if (windows.length === 0 && originalGeojson?.categories?.window) {
        categories.window = {
            type: originalGeojson.categories.window.type || 'MultiPolygon',
            coordinates: originalGeojson.categories.window.coordinates
        };
    } else {
        windows.forEach(window => {
            const depth = wallWidth + 0.1;
            const ww = (window.rotation === 90 || window.rotation === 270) ? depth : window.width;
            const wh = (window.rotation === 90 || window.rotation === 270) ? window.width : depth;
            categories.window.coordinates.push([createBoxRing(window.position.x, window.position.y, ww, wh)]);
        });
    }

    // 5. Generate Stairs
    nodes.filter(n => n.type === 'stair').forEach(stair => {
        const pos = stair.position || stair.centroid || { x: 0, y: 0 };
        const ww = stair.dimensions?.width || 2.5;
        const wh = stair.dimensions?.height || 5.5;
        // Basic fallback for rotation
        const isRot = stair.dimensions?.width && stair.dimensions.width > (stair.dimensions.height || 0);
        categories.stair.coordinates.push([createBoxRing(pos.x, pos.y, ww, wh, isRot ? 90 : 0)]);
    });

    // Generate 'inner' envelope (required for ThreeMassing glass shell)
    const innerEnvelope = {
        type: 'Polygon',
        coordinates: minGlobalX !== Infinity ? [createBoxRing(
            (minGlobalX + maxGlobalX) / 2,
            (minGlobalY + maxGlobalY) / 2,
            maxGlobalX - minGlobalX + wallWidth,
            maxGlobalY - minGlobalY + wallWidth
        )] : []
    };

    return {
        inner: innerEnvelope,
        wall_width: wallWidth,
        categories
    };
}

