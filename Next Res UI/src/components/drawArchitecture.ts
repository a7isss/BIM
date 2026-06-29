import * as d3 from 'd3';
import type { Node, ArchitectureLine, Room, Opening, Scope } from '../types';
// Removed hardcoded ROOM_NAMES import
import { drawStairway } from './drawStairway';
import { drawBuildingEnvelope } from './drawBuildingEnvelope';

const drawRooms = (
    archGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    renderRooms: Room[],
    rooms: Room[],
    openings: Opening[],
    nodes: Node[],
    types: any,
    toPxX: (m: number) => number,
    toPxY: (m: number) => number,
    pxPerMeter: number,
    activeTool: string,
    scope: Scope,
    editingRoomId: string | null,
    setEditingRoomId: (id: string | null) => void,
    updateState: (state: any) => void
) => {
    renderRooms.forEach((room: any) => {
        const roomCoords = Array.isArray(room.nodes) ? room.nodes.map((nid: any) => nodes.find((n:any) => n.id === nid)).filter(Boolean).map((n: any) => [n.x, n.y]) : [];
        if (roomCoords.length > 2) {
            const path = d3.path();
            path.moveTo(toPxX(roomCoords[0][0]), toPxY(roomCoords[0][1]));
            for(let i=1; i<roomCoords.length; i++) {
                path.lineTo(toPxX(roomCoords[i][0]), toPxY(roomCoords[i][1]));
            }
            path.closePath();
            
            let color = '#f3f4f6';
            
            if (room.type_id && types?.rooms) {
                const t = types.rooms.find((r: any) => r.id === room.type_id);
                if (t) {
                    color = t.color;
                } else {
                    const roomColors: Record<string, string> = { 'living': '#dcfce7', 'bedroom': '#dbeafe', 'bathroom': '#fef3c7', 'kitchen': '#fce7f3', 'stair': '#fef08a', 'corridor': '#e5e7eb', 'default': '#f3f4f6' };
                    color = roomColors[room.type] || roomColors['default'];
                }
            } else {
                const roomColors: Record<string, string> = { 'living': '#dcfce7', 'bedroom': '#dbeafe', 'bathroom': '#fef3c7', 'kitchen': '#fce7f3', 'stair': '#fef08a', 'corridor': '#e5e7eb', 'default': '#f3f4f6' };
                color = roomColors[room.type] || roomColors['default'];
            }
            
            archGroup.append('path')
                .attr('d', path.toString())
                .attr('fill', color)
                .attr('fill-opacity', 0.4)
                .attr('stroke', '#d1d5db')
                .attr('stroke-width', 1)
                .style('cursor', activeTool === 'remove_room' ? 'pointer' : 'default')
                .on('click', (e: any) => {
                    if (activeTool === 'remove_room') {
                        e.stopPropagation();
                        updateState({ rooms: rooms.filter((rm: any) => rm.id !== room.id) });
                    }
                });

            if (room.type === 'stair') {
                drawStairway(archGroup, roomCoords, openings, toPxX, toPxY, pxPerMeter);
            }

            if (scope === 'architectural') {
                const rx = d3.mean(roomCoords, (c: any) => toPxX(c[0])) || 0;
                const ry = d3.mean(roomCoords, (c: any) => toPxY(c[1])) || 0;
                
                if (editingRoomId === room.id) {
                    const fo = archGroup.append('foreignObject')
                        .attr('x', rx - 120)
                        .attr('y', ry - 30)
                        .attr('width', 240)
                        .attr('height', 60);
                        
                    const optionsHtml = (types?.rooms || []).map((t: any) => `<option value="${t.id}">${(t.label || t.name || t.id).toUpperCase()}</option>`).join('') + '<option value="default">ROOM</option>';
                    
                    fo.html(`<select class="w-full h-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2 outline-none text-2xl cursor-pointer">${optionsHtml}</select>`);
                    
                    fo.select('select')
                        .property('value', room.type || 'default')
                        .on('change', (e: any) => {
                            updateState({ rooms: rooms.map((rm: any) => rm.id === room.id ? { ...rm, type: e.target.value } : rm) });
                        })
                        .on('blur', () => setEditingRoomId(null));
                } else {
                    const fo = archGroup.append('foreignObject')
                        .attr('x', rx - 200)
                        .attr('y', ry - 30)
                        .attr('width', 400)
                        .attr('height', 60)
                        .style('overflow', 'visible');
                    
                    const roomTypeObj = (types?.rooms || []).find((t: any) => t.id === room.type);
                    const roomLabel = roomTypeObj ? (roomTypeObj.label || roomTypeObj.name || room.type) : (room.type || 'ROOM');
                    
                    fo.html(`
                        <div class="flex items-center justify-center gap-4 w-full h-full">
                            <button class="edit-room-btn text-zinc-500 hover:text-amber-500 transition-colors p-2 rounded-full hover:bg-zinc-800/50" title="Change Room Type">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                            </button>
                            <span class="text-[#4b5563] font-bold font-sans text-4xl whitespace-nowrap pointer-events-none drop-shadow-sm">${roomLabel}</span>
                        </div>
                    `);
                    
                    fo.select('.edit-room-btn').on('click', (e: any) => {
                        e.stopPropagation();
                        setEditingRoomId(room.id);
                    });
                }
            }
        }
    });
};

const drawWalls = (
    archGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    renderArch: ArchitectureLine[],
    architecture: ArchitectureLine[],
    openings: Opening[],
    nodes: Node[],
    types: any,
    toPxX: (m: number) => number,
    toPxY: (m: number) => number,
    fromPxX: (px: number) => number,
    fromPxY: (py: number) => number,
    pxPerMeter: number,
    activeTool: string,
    selectedFloor: string,
    updateState: (state: any) => void
) => {
    // Pass 1: Draw thick black outline
    renderArch.forEach((item: any) => {
        if (item.type === 'wall' && item.n1 && item.n2) {
            const n1 = nodes.find((n:any) => n.id === item.n1);
            const n2 = nodes.find((n:any) => n.id === item.n2);
            if (n1 && n2) {
                const t = types?.walls?.find((w: any) => w.id === item.type_id);
                archGroup.append('line')
                    .attr('x1', toPxX(n1.x))
                    .attr('y1', toPxY(n1.y))
                    .attr('x2', toPxX(n2.x))
                    .attr('y2', toPxY(n2.y))
                    .attr('stroke', '#374151') 
                    .attr('stroke-width', (t?.thickness || 0.2) * pxPerMeter) 
                    .attr('stroke-linecap', 'square')
                    .style('cursor', activeTool === 'remove_arch' || activeTool === 'add_door' || activeTool === 'add_window' ? 'pointer' : 'default')
                    .on('click', (e: any) => {
                        if (activeTool === 'remove_arch') {
                            e.stopPropagation();
                            updateState({ architecture: architecture.filter((el: any) => el.id !== item.id) });
                        } else if (activeTool === 'add_door' || activeTool === 'add_window') {
                            e.stopPropagation();
                            const [px, py] = d3.pointer(e, g.node());
                            const clickX = fromPxX(px);
                            const clickY = fromPxY(py);
                            
                            // Vector math for exact point on segment
                            const vx = n2.x - n1.x;
                            const vy = n2.y - n1.y;
                            const len2 = vx*vx + vy*vy;
                            const t = Math.max(0, Math.min(1, ((clickX - n1.x)*vx + (clickY - n1.y)*vy) / len2));
                            const projX = n1.x + t * vx;
                            const projY = n1.y + t * vy;
                            
                            const len = Math.sqrt(len2);
                            const nx = -vy / len;
                            const ny = vx / len;
                            
                            const newId = `op-${Date.now()}`;
                            const newOpening = {
                                id: newId,
                                type: activeTool === 'add_door' ? 'door' : 'window',
                                level_id: selectedFloor,
                                x: Number(projX.toFixed(2)),
                                y: Number(projY.toFixed(2)),
                                nx: Number(nx.toFixed(2)),
                                ny: Number(ny.toFixed(2))
                            };
                            updateState({ openings: [...openings, newOpening] });
                        } else if (activeTool === 'split_wall') {
                            e.stopPropagation();
                            const [px, py] = d3.pointer(e, g.node());
                            const clickX = fromPxX(px);
                            const clickY = fromPxY(py);
                            
                            // Calculate exact projection on line
                            const dx = n2.x - n1.x;
                            const dy = n2.y - n1.y;
                            const len2 = dx*dx + dy*dy;
                            let t = 0.5;
                            if (len2 > 0) {
                                t = Math.max(0, Math.min(1, ((clickX - n1.x)*dx + (clickY - n1.y)*dy) / len2));
                            }
                            const projX = Number((n1.x + t*dx).toFixed(2));
                            const projY = Number((n1.y + t*dy).toFixed(2));

                            const newNodeId = Math.max(...nodes.map(n => typeof n.id === 'number' ? n.id : parseInt(n.id) || 0), 0) + 1;
                            const newNode = { id: newNodeId, x: projX, y: projY };
                            
                            const newWallId = `aw_${Date.now()}`;
                            const newWall = { ...item, id: newWallId, n1: newNodeId, n2: item.n2 };
                            const updatedWall = { ...item, n2: newNodeId };

                            const newArch = architecture.map(a => a.id === item.id ? updatedWall : a);
                            newArch.push(newWall);
                            
                            updateState({
                                nodes: [...nodes, newNode],
                                architecture: newArch
                            });
                        }
                    })
                    .on('mouseenter', function() {
                        if (activeTool === 'remove_arch' || activeTool === 'split_wall') {
                            d3.select(this).attr('stroke', activeTool === 'remove_arch' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.5)');
                        }
                    })
                    .on('mouseleave', function() {
                        d3.select(this).attr('stroke', 'transparent');
                    });
            }
        }
    });
    
    // Pass 2: Draw inner white hollow fill
    renderArch.forEach((item: any) => {
        if (item.type === 'wall' && item.n1 && item.n2) {
            const n1 = nodes.find((n:any) => n.id === item.n1);
            const n2 = nodes.find((n:any) => n.id === item.n2);
            if (n1 && n2) {
                const coords = [[n1.x, n1.y], [n2.x, n2.y]];
                let innerThickness = 0.12;
                if (item.type_id && types?.walls) {
                    const t = types.walls.find((w: any) => w.id === item.type_id);
                    if (t) innerThickness = Math.max(0.02, t.thickness - 0.08); // Subtract 0.08 to make the outer lines thicker (4cm each)
                }
                archGroup.append('line')
                    .attr('x1', toPxX(coords[0][0]))
                    .attr('y1', toPxY(coords[0][1]))
                    .attr('x2', toPxX(coords[1][0]))
                    .attr('y2', toPxY(coords[1][1]))
                    .attr('stroke', '#f3f4f6')
                    .attr('stroke-width', innerThickness * pxPerMeter) 
                    .attr('stroke-linecap', 'square')
                    .style('pointer-events', 'none'); // Let the thick line handle clicks
            }
        }
    });
};

const drawOpenings = (
    archGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    renderOpenings: Opening[],
    openings: Opening[],
    types: any,
    toPxX: (m: number) => number,
    toPxY: (m: number) => number,
    pxPerMeter: number,
    activeTool: string,
    scope: Scope,
    selectedElementForMove: any,
    setSelectedElementForMove: (el: any) => void,
    updateState: (state: any) => void
) => {
    renderOpenings.forEach((op: any) => {
        let width = op.width || 1.0;
        if (op.type_id && types) {
            const arr = op.type === 'window' ? types.windows : types.doors;
            const t = arr?.find((t: any) => t.id === op.type_id);
            if (t && t.width) width = t.width;
        }
        
        const hW = (width / 2) * pxPerMeter;
        
        const parX = op.nx;
        const parY = -op.ny; 
        
        const normX = -parY; 
        const normY = parX; 
        
        const cx = toPxX(op.x);
        const cy = toPxY(op.y);
        
        const ex1 = cx - parX * hW;
        const ey1 = cy - parY * hW;
        const ex2 = cx + parX * hW;
        const ey2 = cy + parY * hW;
        
        let color = '#ffffff';
        if (op.type === 'door' || op.type === 'front_door') color = '#1e3a8a';
        if (op.type === 'window') color = '#38bdf8'; 
        
        const opGroup = archGroup.append('g')
            .style('cursor', (activeTool === 'remove_door' && (op.type === 'door' || op.type === 'front_door')) || (activeTool === 'remove_window' && op.type === 'window') || activeTool === 'move_element' || activeTool === 'rotate_opening' ? 'pointer' : 'default')
            .on('click', (e: any) => {
                if ((activeTool === 'remove_door' && (op.type === 'door' || op.type === 'front_door')) || (activeTool === 'remove_window' && op.type === 'window')) {
                    e.stopPropagation();
                    updateState({ openings: openings.filter((o: any) => o.id !== op.id) });
                } else if (activeTool === 'move_element') {
                    e.stopPropagation();
                    setSelectedElementForMove({ id: op.id, type: op.type });
                } else if (activeTool === 'rotate_opening') {
                    e.stopPropagation();
                    const stateId = (op.stateId || 0) + 1;
                    const step = stateId % 8;
                    const baseNx = op.original_nx !== undefined ? op.original_nx : op.nx;
                    const baseNy = op.original_ny !== undefined ? op.original_ny : op.ny;
                    
                    let nNx = baseNx;
                    let nNy = baseNy;
                    if (step >= 4) {
                        nNx = -baseNy;
                        nNy = baseNx;
                    }
                    
                    const subStep = step % 4;
                    const sSide = (subStep === 1 || subStep === 2) ? -1 : 1;
                    const hSide = (subStep === 2 || subStep === 3) ? -1 : 1;
                    
                    updateState({
                        openings: openings.map((o: any) => o.id === op.id ? { 
                            ...o, 
                            stateId, 
                            original_nx: baseNx, 
                            original_ny: baseNy, 
                            nx: nNx, 
                            ny: nNy, 
                            swing_side: sSide, 
                            hinge_side: hSide 
                        } : o)
                    });
                }
            });

        if (selectedElementForMove && selectedElementForMove.id === op.id) {
            opGroup.append('rect')
                .attr('x', Math.min(ex1, ex2) - 10)
                .attr('y', Math.min(ey1, ey2) - 10)
                .attr('width', Math.abs(ex2 - ex1) + 20)
                .attr('height', Math.abs(ey2 - ey1) + 20)
                .attr('fill', 'none')
                .attr('stroke', '#eab308')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '4,4');
        }

        const wallThickPx = 0.2 * pxPerMeter;

        opGroup.append('line')
            .attr('x1', ex1).attr('y1', ey1)
            .attr('x2', ex2).attr('y2', ey2)
            .attr('stroke', '#fcfbf9')
            .attr('stroke-width', wallThickPx + 2)
            .attr('stroke-linecap', 'butt');

        let shapeId = op.type === 'window' ? 'fixed_window' : 'swinging_door';
        if (op.type_id && types) {
            const arr = op.type === 'window' ? types.windows : types.doors;
            const t = arr?.find((t: any) => t.id === op.type_id);
            if (t && t.shape) shapeId = t.shape;
        }

        const shapes = types?.shapes || {};
        const shapeDef = shapes[shapeId] || shapes['swinging_door'] || [];

        const W = width * pxPerMeter;
        const T = wallThickPx;

        const mapPoint = (nx: number, ny: number) => {
            const px = cx + parX * (nx * W) + normX * (ny * T);
            const py = cy + parY * (nx * W) + normY * (ny * T);
            return [px, py];
        };

        shapeDef.forEach((elem: any) => {
            if (elem.type === 'line') {
                const [p1x, p1y] = mapPoint(elem.x1, elem.y1);
                const [p2x, p2y] = mapPoint(elem.x2, elem.y2);
                opGroup.append('line')
                    .attr('x1', p1x).attr('y1', p1y)
                    .attr('x2', p2x).attr('y2', p2y)
                    .attr('stroke', color)
                    .attr('stroke-width', elem.strokeWidth || 1)
                    .attr('stroke-linecap', 'butt')
                    .attr('stroke-dasharray', elem.strokeDasharray || 'none');
            } else if (elem.type === 'leaf' || elem.type === 'leaf_double') {
                const isDouble = elem.type === 'leaf_double';
                const hingeSide = op.hinge_side || 1;
                const swingSide = op.swing_side || 1;
                
                const drawLeaf = (hSide: number) => {
                    const hx = hSide === 1 ? ex1 : ex2;
                    const hy = hSide === 1 ? ey1 : ey2;
                    const leafLen = isDouble ? W / 2 : W;
                    const openX = hx + normX * leafLen * swingSide;
                    const openY = hy + normY * leafLen * swingSide;
                    
                    opGroup.append('line')
                        .attr('x1', hx).attr('y1', hy)
                        .attr('x2', openX).attr('y2', openY)
                        .attr('stroke', color)
                        .attr('stroke-width', 3)
                        .attr('stroke-linecap', 'round');
                };
                
                if (isDouble) {
                    drawLeaf(1);
                    drawLeaf(-1);
                } else {
                    drawLeaf(hingeSide);
                }
            } else if (elem.type === 'swing_arc' || elem.type === 'swing_arc_double') {
                const isDouble = elem.type === 'swing_arc_double';
                const hingeSide = op.hinge_side || 1;
                const swingSide = op.swing_side || 1;
                
                const drawArc = (hSide: number) => {
                    const hx = hSide === 1 ? ex1 : ex2;
                    const hy = hSide === 1 ? ey1 : ey2;
                    
                    let lx, ly;
                    if (isDouble) {
                        lx = cx;
                        ly = cy;
                    } else {
                        lx = hSide === 1 ? ex2 : ex1;
                        ly = hSide === 1 ? ey2 : ey1;
                    }
                    
                    const leafLen = isDouble ? W / 2 : W;
                    const openX = hx + normX * leafLen * swingSide;
                    const openY = hy + normY * leafLen * swingSide;
                    
                    const cross = (lx - hx) * (openY - hy) - (ly - hy) * (openX - hx);
                    const sweepFlag = cross > 0 ? 1 : 0;
                    const d = `M ${lx} ${ly} A ${leafLen} ${leafLen} 0 0 ${sweepFlag} ${openX} ${openY}`;
                    
                    opGroup.append('path')
                        .attr('d', d)
                        .attr('fill', 'none')
                        .attr('stroke', color)
                        .attr('stroke-width', 1.5)
                        .attr('stroke-dasharray', '4 4');
                };
                
                if (isDouble) {
                    drawArc(1);
                    drawArc(-1);
                } else {
                    drawArc(hingeSide);
                }
            }
        });
            
        if (scope === 'architectural') {
            opGroup.append('text')
                .attr('x', cx)
                .attr('y', cy - 14)
                .attr('text-anchor', 'middle')
                .attr('fill', color)
                .attr('font-size', '14px')
                .attr('font-weight', 'bold')
                .text(op.type === 'window' ? 'W' : 'D');
        }
    });
};

export const drawArchitecture = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    renderRooms: Room[],
    renderArch: ArchitectureLine[],
    renderOpenings: Opening[],
    nodes: Node[],
    types: any,
    toPxX: (m: number) => number,
    toPxY: (m: number) => number,
    fromPxX: (px: number) => number,
    fromPxY: (py: number) => number,
    pxPerMeter: number,
    scope: Scope,
    activeTool: string,
    rooms: Room[],
    architecture: ArchitectureLine[],
    openings: Opening[],
    updateState: (state: any) => void,
    editingRoomId: string | null,
    setEditingRoomId: (id: string | null) => void,
    archOpacity: number,
    selectedFloor: string,
    selectedElementForMove: any,
    setSelectedElementForMove: (el: any) => void,
    project_info?: any
) => {
    const archGroup = g.append('g').attr('class', 'architecture-layer').attr('opacity', archOpacity);
    const isEditMode = scope === 'architectural';

    // 1. Draw Rooms
    if (renderRooms.length > 0) {
        drawRooms(
            archGroup, 
            renderRooms, 
            rooms, 
            openings,
            nodes, 
            types, 
            toPxX, 
            toPxY, 
            pxPerMeter,
            activeTool, 
            scope, 
            editingRoomId, 
            setEditingRoomId, 
            updateState
        );
    }

    // 2. Draw Nodes for node tools
    if (isEditMode && (activeTool === 'move_node' || activeTool === 'remove_node')) {
        const nodeGroup = archGroup.append('g').attr('class', 'architecture-nodes');
        nodes.forEach(node => {
            const isSelected = selectedElementForMove?.id === String(node.id) && selectedElementForMove?.type === 'node';
            nodeGroup.append('circle')
                .attr('cx', toPxX(node.x))
                .attr('cy', toPxY(node.y))
                .attr('r', 10)
                .attr('fill', activeTool === 'remove_node' ? 'rgba(239, 68, 68, 0.6)' : (isSelected ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.4)'))
                .attr('stroke', activeTool === 'remove_node' ? '#ef4444' : '#3b82f6')
                .attr('stroke-width', 2)
                .style('cursor', activeTool === 'move_node' ? 'move' : 'pointer')
                .on('click', (e: any) => {
                    e.stopPropagation();
                    if (activeTool === 'remove_node') {
                        const connectedWalls = architecture.filter(a => a.n1 === node.id || a.n2 === node.id);
                        let newArch = architecture.filter(a => a.n1 !== node.id && a.n2 !== node.id);
                        
                        if (connectedWalls.length === 2 && connectedWalls[0].type_id === connectedWalls[1].type_id) {
                            const w1 = connectedWalls[0];
                            const w2 = connectedWalls[1];
                            const otherNode1 = w1.n1 === node.id ? w1.n2 : w1.n1;
                            const otherNode2 = w2.n1 === node.id ? w2.n2 : w2.n1;
                            newArch.push({ ...w1, id: `aw_${Date.now()}`, n1: otherNode1, n2: otherNode2 });
                        }
                        
                        updateState({
                            nodes: nodes.filter(n => n.id !== node.id),
                            architecture: newArch
                        });
                    } else if (activeTool === 'move_node') {
                        setSelectedElementForMove({ id: String(node.id), type: 'node' });
                    }
                })
                .on('mouseenter', function() {
                    d3.select(this).attr('r', 14).attr('fill', activeTool === 'remove_node' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(59, 130, 246, 0.8)');
                })
                .on('mouseleave', function() {
                    d3.select(this).attr('r', 10).attr('fill', activeTool === 'remove_node' ? 'rgba(239, 68, 68, 0.6)' : (isSelected ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.4)'));
                });
        });
    }

    // Draw Building Envelope and get bounds
    const envelope = drawBuildingEnvelope(archGroup, renderArch, nodes, types, toPxX, toPxY, pxPerMeter);

    // Draw Plot / Fence Boundaries
    if (envelope && project_info?.plot?.setbacks_m) {
        const plot = project_info.plot;
        const setbacks = plot.setbacks_m;
        
        // Tightly hug the building: The red dashed envelope touches the walls,
        // and the solid fence is exactly at the setback distances.
        const fenceMinX = envelope.minX - setbacks.front;
        const fenceMaxX = envelope.maxX + setbacks.rear; 
        const fenceMinY = envelope.minY - setbacks.side2;
        const fenceMaxY = envelope.maxY + setbacks.side1; 

        // Draw solid fence (200mm wall)
        const fenceT = 0.2;
        archGroup.insert('rect', ':first-child') // insert at back
            .attr('class', 'plot-fence')
            .attr('x', toPxX(fenceMinX + fenceT/2))
            .attr('y', toPxY(fenceMaxY - fenceT/2)) // Top is max Y
            .attr('width', (fenceMaxX - fenceMinX - fenceT) * pxPerMeter)
            .attr('height', (fenceMaxY - fenceMinY - fenceT) * pxPerMeter)
            .attr('fill', '#fcfbf9') // Pearl color background for plot
            .attr('stroke', '#374151') // Wall color
            .attr('stroke-width', fenceT * pxPerMeter);
            
        // Draw the allowable building envelope (Setback limit)
        // This now touches the building walls perfectly.
        archGroup.insert('rect', '.plot-fence + *') // insert right after fence
            .attr('class', 'building-envelope-limit')
            .attr('x', toPxX(envelope.minX))
            .attr('y', toPxY(envelope.maxY))
            .attr('width', (envelope.maxX - envelope.minX) * pxPerMeter)
            .attr('height', (envelope.maxY - envelope.minY) * pxPerMeter)
            .attr('fill', 'none')
            .attr('stroke', '#ef4444') // Red dashed border
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .style('pointer-events', 'none');
            
        // Add label for fence
        archGroup.append('text')
            .attr('x', toPxX(fenceMinX) + 10)
            .attr('y', toPxY(fenceMaxY) + 24)
            .attr('fill', '#6b7280')
            .attr('font-size', '16px')
            .attr('font-weight', 'bold')
            .attr('font-family', 'sans-serif')
            .text('PROPERTY FENCE (KSA Riyadh Regulations)');
    }

    // 2. Draw Walls
    if (renderArch.length > 0) {
        drawWalls(archGroup, g, renderArch, architecture, openings, nodes, types, toPxX, toPxY, fromPxX, fromPxY, pxPerMeter, activeTool, selectedFloor, updateState);
    }
    
    // 3. Draw Openings
    if (renderOpenings.length > 0) {
        drawOpenings(archGroup, renderOpenings, openings, types, toPxX, toPxY, pxPerMeter, activeTool, scope, selectedElementForMove, setSelectedElementForMove, updateState);
    }
};
