import * as d3 from 'd3';

export const drawArchitecture = (
    g: any,
    renderRooms: any[],
    renderArch: any[],
    renderOpenings: any[],
    nodes: any[],
    types: any,
    toPxX: (m: number) => number,
    toPxY: (m: number) => number,
    pxPerMeter: number,
    scope: string,
    activeTool: string,
    rooms: any[],
    architecture: any[],
    openings: any[],
    updateState: (state: any) => void,
    editingRoomId: string | null,
    setEditingRoomId: (id: string | null) => void,
    archOpacity: number
) => {
    const roomNames: Record<string, string> = { 
        'living': 'LIVING (🛋️)', 
        'bedroom': 'BEDROOM (🛏️)', 
        'bathroom': 'BATHROOM (🚽)', 
        'kitchen': 'KITCHEN (🍳)', 
        'default': 'ROOM' 
    };

    const archGroup = g.append('g').attr('class', 'architecture-layer').attr('opacity', archOpacity);
    
    // 1. Draw Rooms
    if (renderRooms.length > 0) {
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
                let label = room.type ? room.type.toUpperCase() : 'ROOM';
                
                if (room.type_id && types?.rooms) {
                    const t = types.rooms.find((r: any) => r.id === room.type_id);
                    if (t) {
                        color = t.color;
                        label = t.label;
                    }
                } else {
                    const roomColors: Record<string, string> = { 'living': '#dcfce7', 'bedroom': '#dbeafe', 'bathroom': '#fef3c7', 'kitchen': '#fce7f3', 'default': '#f3f4f6' };
                    color = roomColors[room.type] || roomColors['default'];
                    label = roomNames[room.type] || (room.type ? room.type.toUpperCase() : roomNames['default']);
                }
                
                archGroup.append('path')
                    .attr('d', path.toString())
                    .attr('fill', color)
                    .attr('stroke', '#d1d5db')
                    .attr('stroke-width', 1);

                if (scope === 'architectural') {
                    const rx = d3.mean(roomCoords, (c: any) => toPxX(c[0])) || 0;
                    const ry = d3.mean(roomCoords, (c: any) => toPxY(c[1])) || 0;
                    
                    if (editingRoomId === room.id) {
                        const fo = archGroup.append('foreignObject')
                            .attr('x', rx - 60)
                            .attr('y', ry - 15)
                            .attr('width', 120)
                            .attr('height', 30);
                            
                        const optionsHtml = '<option value="living">LIVING</option><option value="bedroom">BEDROOM</option><option value="bathroom">BATHROOM</option><option value="kitchen">KITCHEN</option><option value="default">ROOM</option>';
                        
                        fo.html(`<select class="w-full h-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-1 outline-none text-sm cursor-pointer">${optionsHtml}</select>`);
                        
                        fo.select('select')
                            .property('value', room.type || 'default')
                            .on('change', (e: any) => {
                                // Use the full array so we don't accidentally wipe it
                                updateState({ rooms: rooms.map((rm: any) => rm.id === room.id ? { ...rm, type: e.target.value } : rm) });
                            })
                            .on('blur', () => setEditingRoomId(null));
                    } else {
                        const fo = archGroup.append('foreignObject')
                            .attr('x', rx - 100)
                            .attr('y', ry - 15)
                            .attr('width', 200)
                            .attr('height', 30)
                            .style('overflow', 'visible');
                        
                        fo.html(`
                            <div class="flex items-center justify-center gap-2 w-full h-full">
                                <button class="edit-room-btn text-zinc-500 hover:text-amber-500 transition-colors p-1 rounded-full hover:bg-zinc-800/50" title="Change Room Type">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                                </button>
                                <span class="text-[#4b5563] font-bold font-sans text-xl whitespace-nowrap pointer-events-none drop-shadow-sm">${roomNames[room.type] || roomNames['default']}</span>
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
    }

    // 2. Draw Walls
    if (renderArch.length > 0) {
        // Pass 1: Draw thick black outline
        renderArch.forEach((item: any) => {
            if (item.type === 'wall' && item.n1 && item.n2) {
                const n1 = nodes.find((n:any) => n.id === item.n1);
                const n2 = nodes.find((n:any) => n.id === item.n2);
                if (n1 && n2) {
                    const coords = [[n1.x, n1.y], [n2.x, n2.y]];
                    let typeThickness = 0.2;
                    if (item.type_id && types?.walls) {
                        const t = types.walls.find((w: any) => w.id === item.type_id);
                        if (t) typeThickness = t.thickness;
                    }
                    archGroup.append('line')
                        .attr('x1', toPxX(coords[0][0]))
                        .attr('y1', toPxY(coords[0][1]))
                        .attr('x2', toPxX(coords[1][0]))
                        .attr('y2', toPxY(coords[1][1]))
                        .attr('stroke', '#374151') // gray-700
                        .attr('stroke-width', typeThickness * pxPerMeter)
                        .attr('stroke-linecap', 'square')
                        .style('cursor', activeTool === 'remove_arch' ? 'pointer' : 'default')
                        .on('click', (e: any) => {
                            if (activeTool === 'remove_arch') {
                                e.stopPropagation();
                                updateState({ architecture: architecture.filter((el: any) => el.id !== item.id) });
                            }
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
                    let innerThickness = 0.16;
                    if (item.type_id && types?.walls) {
                        const t = types.walls.find((w: any) => w.id === item.type_id);
                        if (t) innerThickness = Math.max(0.05, t.thickness - 0.04);
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
    }
    
    // 3. Draw Openings
    if (renderOpenings.length > 0) {
        renderOpenings.forEach((op: any) => {
            let width = op.width || 1.0;
            if (op.type_id && types) {
                const arr = op.type === 'window' ? types.windows : types.doors;
                const t = arr?.find((t: any) => t.id === op.type_id);
                if (t && t.width) width = t.width;
            }
            
            const hW = (width / 2) * pxPerMeter;
            const dirX = op.nx;
            const dirY = -op.ny; 
            
            const cx = toPxX(op.x);
            const cy = toPxY(op.y);
            
            const x1 = cx - dirX * hW;
            const y1 = cy - dirY * hW;
            const x2 = cx + dirX * hW;
            const y2 = cy + dirY * hW;
            
            let color = '#ffffff';
            if (op.type === 'door' || op.type === 'front_door') color = '#fb923c'; 
            if (op.type === 'window') color = '#38bdf8'; 
            
            const opGroup = archGroup.append('g')
                .style('cursor', (activeTool === 'remove_door' && op.type === 'door') || (activeTool === 'remove_window' && op.type === 'window') ? 'pointer' : 'default')
                .on('click', (e: any) => {
                    if ((activeTool === 'remove_door' && op.type === 'door') || (activeTool === 'remove_window' && op.type === 'window')) {
                        e.stopPropagation();
                        updateState({ openings: openings.filter((o: any) => o.id !== op.id) });
                    }
                });
                
            opGroup.append('line')
                .attr('x1', x1)
                .attr('y1', y1)
                .attr('x2', x2)
                .attr('y2', y2)
                .attr('stroke', color)
                .attr('stroke-width', 0.22 * pxPerMeter) 
                .attr('stroke-linecap', 'butt');
                
            if (scope === 'architectural') {
                opGroup.append('text')
                    .attr('x', cx)
                    .attr('y', cy - 12)
                    .attr('text-anchor', 'middle')
                    .attr('fill', color)
                    .attr('font-size', '10px')
                    .attr('font-weight', 'bold')
                    .text(op.type === 'window' ? 'W' : 'D');
            }
        });
    }
    
    // 4. Draw Plot Boundary
    if (renderArch.length > 0 && scope === 'architectural') {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        renderArch.forEach((item: any) => {
            if (item.type === 'wall' && item.n1 && item.n2) {
                const n1 = nodes.find((n:any) => n.id === item.n1);
                const n2 = nodes.find((n:any) => n.id === item.n2);
                if (n1 && n2) {
                    const coords = [[n1.x, n1.y], [n2.x, n2.y]];
                    coords.forEach((c: any) => {
                    if (c[0] < minX) minX = c[0];
                    if (c[0] > maxX) maxX = c[0];
                    if (c[1] < minY) minY = c[1];
                    if (c[1] > maxY) maxY = c[1];
                });
                }
            }
        });

        if (minX !== Infinity) {
            const setbackX = 2; 
            const setbackY = 3; 
            
            const pMinX = minX - setbackX;
            const pMaxX = maxX + setbackX;
            const pMinY = minY - setbackY;
            const pMaxY = maxY + setbackY;
            
            archGroup.append('rect')
                .attr('x', toPxX(pMinX))
                .attr('y', toPxY(pMaxY)) 
                .attr('width', (pMaxX - pMinX) * pxPerMeter)
                .attr('height', (pMaxY - pMinY) * pxPerMeter)
                .attr('fill', 'none')
                .attr('stroke', '#6b7280') 
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '8,8');
                
            archGroup.append('text')
                .attr('x', toPxX(pMinX) + 10)
                .attr('y', toPxY(pMaxY) + 20)
                .attr('fill', '#9ca3af')
                .attr('font-size', '12px')
                .attr('font-family', 'sans-serif')
                .text('PLOT BOUNDARY (3m Front/Back, 2m Sides)');
        }
    }
};
