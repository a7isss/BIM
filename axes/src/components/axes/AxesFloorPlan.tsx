import React, { useMemo, useState } from 'react';
import { useAxesStore } from '../../store/useAxesStore';
import { DoorWindowLayer, WallGraphLayer } from './editors';

// Clean CAD-like styles
const CATEGORY_STYLES: Record<string, { fill: string; stroke: string; label: string }> = {
    living: { fill: 'rgba(255, 255, 255, 0.05)', stroke: '#444', label: 'Living' },
    bedroom: { fill: 'rgba(255, 255, 255, 0.05)', stroke: '#444', label: 'Bedroom' },
    bathroom: { fill: 'rgba(255, 255, 255, 0.05)', stroke: '#444', label: 'Bathroom' },
    kitchen: { fill: 'rgba(255, 255, 255, 0.05)', stroke: '#444', label: 'Kitchen' },
    door: { fill: '#000000', stroke: '#00ffff', label: 'Door' },
    window: { fill: '#111111', stroke: '#ffff00', label: 'Window' },
    wall: { fill: '#ffffff', stroke: '#ffffff', label: 'Wall' },
    front_door: { fill: '#000000', stroke: '#00ffff', label: 'Front Door' },
    balcony: { fill: 'rgba(255, 255, 255, 0.02)', stroke: '#444', label: 'Balcony' },
    stair: { fill: 'url(#stairHatch)', stroke: '#f87171', label: 'Stair' },
};

const DRAW_ORDER = ['wall', 'living', 'bedroom', 'bathroom', 'kitchen', 'balcony', 'stair', 'front_door', 'door', 'window'];
// Note: 'door' and 'window' are rendered from GeoJSON for legacy data, or by DoorWindowLayer for new data

interface AxesFloorPlanProps {
    showColors?: boolean;
    activeFloor?: 'ground' | 'first' | 'roof';
}

// ── Setback zone descriptor ──────────────────────────────────────────────────
interface SetbackZone {
    x: number; y: number; w: number; h: number;
    color: string; label: string; labelX: number; labelY: number; labelAnchor: string;
}

// ── Entrance arrow descriptor ─────────────────────────────────────────────────
interface EntranceArrow {
    x: number; y: number; rotation: number; labelDx: number; labelDy: number;
}

// ── Lot rectangle ─────────────────────────────────────────────────────────────
interface LotRect { left: number; top: number; right: number; bottom: number; }

function computeSetbackLayout(
    frontSide: 'north' | 'south' | 'east' | 'west',
    bx1: number, by1: number, bx2: number, by2: number, // building SVG bbox
    fSvg: number, sSvg: number, rSvg: number,           // front / side / rear in SVG units
): { lotRect: LotRect; zones: SetbackZone[]; entrance: EntranceArrow } {

    let lotRect: LotRect;
    let zones: SetbackZone[] = [];
    let entrance: EntranceArrow;

    const bw = bx2 - bx1; // building width in SVG
    const bh = by2 - by1; // building height in SVG

    // Helper to create a zone rect
    const zone = (x: number, y: number, w: number, h: number,
        color: string, label: string, ax: number, ay: number, anchor = 'middle'): SetbackZone =>
        ({ x, y, w, h, color, label, labelX: ax, labelY: ay, labelAnchor: anchor });

    switch (frontSide) {
        case 'north': {
            // Street is North (top of drawing)
            lotRect = { left: bx1 - sSvg, top: by1 - fSvg, right: bx2 + sSvg, bottom: by2 + rSvg };
            const lw = lotRect.right - lotRect.left;
            zones = [
                zone(lotRect.left, lotRect.top, lw, fSvg,
                    'rgba(251,146,60,0.20)', `Front ${fSvg > 0 ? '' : ''}${Math.round(fSvg / (fSvg || 1))}m`,
                    lotRect.left + lw / 2, lotRect.top + fSvg / 2),
                ...(rSvg > 0 ? [zone(lotRect.left, by2, lw, rSvg,
                    'rgba(74,222,128,0.17)', '',
                    lotRect.left + lw / 2, by2 + rSvg / 2)] : []),
                ...(sSvg > 0 ? [
                    zone(lotRect.left, by1, sSvg, bh, 'rgba(96,165,250,0.17)', '', lotRect.left + sSvg / 2, by1 + bh / 2),
                    zone(bx2, by1, sSvg, bh, 'rgba(96,165,250,0.17)', '', bx2 + sSvg / 2, by1 + bh / 2),
                ] : []),
            ];
            entrance = { x: bx1 + bw / 2, y: lotRect.top + fSvg / 2, rotation: 180, labelDx: 0, labelDy: -14 };
            break;
        }
        case 'south': {
            lotRect = { left: bx1 - sSvg, top: by1 - rSvg, right: bx2 + sSvg, bottom: by2 + fSvg };
            const lw = lotRect.right - lotRect.left;
            zones = [
                zone(lotRect.left, by2, lw, fSvg,
                    'rgba(251,146,60,0.20)', '',
                    lotRect.left + lw / 2, by2 + fSvg / 2),
                ...(rSvg > 0 ? [zone(lotRect.left, lotRect.top, lw, rSvg,
                    'rgba(74,222,128,0.17)', '', lotRect.left + lw / 2, lotRect.top + rSvg / 2)] : []),
                ...(sSvg > 0 ? [
                    zone(lotRect.left, by1, sSvg, bh, 'rgba(96,165,250,0.17)', '', lotRect.left + sSvg / 2, by1 + bh / 2),
                    zone(bx2, by1, sSvg, bh, 'rgba(96,165,250,0.17)', '', bx2 + sSvg / 2, by1 + bh / 2),
                ] : []),
            ];
            entrance = { x: bx1 + bw / 2, y: by2 + fSvg / 2, rotation: 0, labelDx: 0, labelDy: 18 };
            break;
        }
        case 'east': {
            lotRect = { left: bx1 - rSvg, top: by1 - sSvg, right: bx2 + fSvg, bottom: by2 + sSvg };
            const lh = lotRect.bottom - lotRect.top;
            zones = [
                zone(bx2, lotRect.top, fSvg, lh,
                    'rgba(251,146,60,0.20)', '',
                    bx2 + fSvg / 2, lotRect.top + lh / 2),
                ...(rSvg > 0 ? [zone(lotRect.left, lotRect.top, rSvg, lh,
                    'rgba(74,222,128,0.17)', '', lotRect.left + rSvg / 2, lotRect.top + lh / 2)] : []),
                ...(sSvg > 0 ? [
                    zone(bx1, lotRect.top, bw, sSvg, 'rgba(96,165,250,0.17)', '', bx1 + bw / 2, lotRect.top + sSvg / 2),
                    zone(bx1, by2, bw, sSvg, 'rgba(96,165,250,0.17)', '', bx1 + bw / 2, by2 + sSvg / 2),
                ] : []),
            ];
            entrance = { x: bx2 + fSvg / 2, y: by1 + bh / 2, rotation: -90, labelDx: 14, labelDy: 0 };
            break;
        }
        case 'west':
        default: {
            lotRect = { left: bx1 - fSvg, top: by1 - sSvg, right: bx2 + rSvg, bottom: by2 + sSvg };
            const lh = lotRect.bottom - lotRect.top;
            zones = [
                zone(lotRect.left, lotRect.top, fSvg, lh,
                    'rgba(251,146,60,0.20)', '',
                    lotRect.left + fSvg / 2, lotRect.top + lh / 2),
                ...(rSvg > 0 ? [zone(bx2, lotRect.top, rSvg, lh,
                    'rgba(74,222,128,0.17)', '', bx2 + rSvg / 2, lotRect.top + lh / 2)] : []),
                ...(sSvg > 0 ? [
                    zone(bx1, lotRect.top, bw, sSvg, 'rgba(96,165,250,0.17)', '', bx1 + bw / 2, lotRect.top + sSvg / 2),
                    zone(bx1, by2, bw, sSvg, 'rgba(96,165,250,0.17)', '', bx1 + bw / 2, by2 + sSvg / 2),
                ] : []),
            ];
            entrance = { x: lotRect.left + fSvg / 2, y: by1 + bh / 2, rotation: 90, labelDx: -14, labelDy: 0 };
            break;
        }
    }

    return { lotRect, zones, entrance };
}

// Compass rose directions relative to frontSide
const COMPASS_DIRS: Record<'north' | 'south' | 'east' | 'west', Record<string, number>> = {
    north: { N: -90, E: 0, S: 90, W: 180 },
    south: { S: -90, W: 0, N: 90, E: 180 },
    east: { E: -90, S: 0, W: 90, N: 180 },
    west: { W: -90, N: 0, E: 90, S: 180 },
};

const AxesFloorPlan: React.FC<AxesFloorPlanProps> = ({ showColors = false, activeFloor = 'ground' }) => {
    const { activeLayout, selectedNodeId, setSelectedNodeId, siteParams, setbackOverrides, editingMode, interactionMode, updateStairPosition, updateNodePosition } = useAxesStore();
    const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
    const svgRef = React.useRef<SVGSVGElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [containerBounds, setContainerBounds] = React.useState<DOMRect | null>(null);
    const [dragStartPos, setDragStartPos] = useState<{ x: number, y: number, cat: string } | null>(null);
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [dragNodeStart, setDragNodeStart] = useState<{ x: number; y: number } | null>(null);

    // Get container bounds for door/window placement
    React.useEffect(() => {
        if (containerRef.current) {
            setContainerBounds(containerRef.current.getBoundingClientRect());
        }
    }, []);

    const geojson = activeLayout?.floor_plan_geojson_floors
        ? activeLayout.floor_plan_geojson_floors[activeFloor]
        : activeLayout?.floor_plan_geojson;

    // ── Derived setbacks (with overrides) ──────────────────────
    const defaultFrontSetback = Math.min(6, Math.max(3, siteParams.streetWidth / 5));
    const defaultSideSetback = siteParams.isGroundFloor ? 0 : 2;
    const defaultRearSetback = siteParams.isGroundFloor ? 0 : 2;

    const frontSetback = setbackOverrides.front !== null ? setbackOverrides.front : defaultFrontSetback;
    const sideSetback = setbackOverrides.side !== null ? setbackOverrides.side : defaultSideSetback;
    const rearSetback = setbackOverrides.rear !== null ? setbackOverrides.rear : defaultRearSetback;

    const renderData = useMemo(() => {
        if (!geojson || !geojson.categories) return null;

        const allPts: number[][] = [];
        const collect = (coords: any) => {
            if (!coords || !coords.length) return;
            if (typeof coords[0] === 'number') { allPts.push(coords); return; }
            coords.forEach(collect);
        };

        Object.values(geojson.categories).forEach((g: any) => {
            if (g.coordinates) collect(g.coordinates);
            else if (g.geometries) g.geometries.forEach((sg: any) => collect(sg.coordinates));
        });
        if (geojson.inner?.coordinates) collect(geojson.inner.coordinates);
        if (allPts.length === 0) return null;

        const xs = allPts.map(p => p[0]);
        const ys = allPts.map(p => p[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const width = maxX - minX, height = maxY - minY;

        const PADDING = 20;
        // Keep the original building scale!
        const scale = 960 / Math.max(width, height);

        let offsetX = -minX + (Math.max(width, height) - width) / 2 + PADDING / scale;
        let offsetY = -minY + (Math.max(width, height) - height) / 2 + PADDING / scale;

        // NEW: If front is North, zero out the top margin so building starts exactly after setback
        // We calculate how much extra padding the centering added, and subtract it from the side touching the street
        const extraPadX = (Math.max(width, height) - width) / 2;
        const extraPadY = (Math.max(width, height) - height) / 2;

        if (siteParams.frontSide === 'north') offsetY -= extraPadY;
        if (siteParams.frontSide === 'south') offsetY += extraPadY;
        if (siteParams.frontSide === 'west') offsetX -= extraPadX;
        if (siteParams.frontSide === 'east') offsetX += extraPadX;

        // Building bounding box in SVG units
        const bx1 = (minX + offsetX) * scale;
        const by1 = (minY + offsetY) * scale;
        const bx2 = (maxX + offsetX) * scale;
        const by2 = (maxY + offsetY) * scale;

        return { scale, offsetX, offsetY, width, height, bx1, by1, bx2, by2 };
    }, [geojson, siteParams.frontSide]);

    if (!activeLayout || !geojson || !renderData) {
        return (
            <div className="w-full h-full flex items-center justify-center text-zinc-600 italic">
                No floor plan geometry available
            </div>
        );
    }

    const { scale, offsetX, offsetY, bx1, by1, bx2, by2 } = renderData;

    // ── Setback computation ───────────────────────────────────────────────────
    const fSvg = frontSetback * scale;
    const sSvg = sideSetback * scale;
    const rSvg = rearSetback * scale;

    const { lotRect, zones, entrance } = computeSetbackLayout(
        siteParams.frontSide, bx1, by1, bx2, by2, fSvg, sSvg, rSvg
    );

    // ── Dynamic viewBox to expose lot + outer margin ──────────────────────────
    const OUTER_PAD = 40;
    const vbX = lotRect.left - OUTER_PAD;
    const vbY = lotRect.top - OUTER_PAD;
    const vbW = (lotRect.right - lotRect.left) + 2 * OUTER_PAD;
    const vbH = (lotRect.bottom - lotRect.top) + 2 * OUTER_PAD;

    // ── Compass rose position (top-right corner of viewBox) ───────────────────
    const compassX = lotRect.right + OUTER_PAD - 28;
    const compassY = lotRect.top - OUTER_PAD + 28;
    const compassR = 20;

    // ── GeoJSON → SVG path ────────────────────────────────────────────────────
    const toSvgPath = (geom: any) => {
        const toS = (p: number[]) => `${((p[0] + offsetX) * scale).toFixed(2)},${((p[1] + offsetY) * scale).toFixed(2)}`;
        const ringToD = (ring: number[][]) => 'M ' + ring.map(toS).join(' L ') + ' Z';
        if (!geom) return '';
        if (geom.type === 'Polygon') return geom.coordinates.map(ringToD).join(' ');
        if (geom.type === 'MultiPolygon') return geom.coordinates.flatMap((p: any) => p.map(ringToD)).join(' ');
        if (geom.type === 'LineString') return 'M ' + geom.coordinates.map(toS).join(' L ');
        if (geom.type === 'MultiLineString') return geom.coordinates.map((c: any) => 'M ' + c.map(toS).join(' L ')).join(' ');
        return '';
    };

    // ── Entrance arrow polygon ────────────────────────────────────────────────
    const arrowSize = Math.max(12, fSvg * 0.28);
    const arrowPts = `0,${-arrowSize} ${arrowSize * 0.6},0 ${-arrowSize * 0.6},0`;

    const handlePointerDown = (e: React.PointerEvent, cat: string) => {
        if (editingMode !== 'move' || cat !== 'stair') return;
        setDragStartPos({ x: e.clientX, y: e.clientY, cat });
        (e.target as Element).setPointerCapture(e.pointerId);
        e.stopPropagation();
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragStartPos || dragStartPos.cat !== 'stair' || editingMode !== 'move') return;
        if (!svgRef.current) return;

        const CTM = svgRef.current.getScreenCTM();
        if (!CTM) return;

        const dxCtx = (e.clientX - dragStartPos.x) / CTM.a;
        const dyCtx = (e.clientY - dragStartPos.y) / CTM.d;

        updateStairPosition(dxCtx / scale, dyCtx / scale);
        setDragStartPos({ x: e.clientX, y: e.clientY, cat: dragStartPos.cat });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (dragStartPos) {
            (e.target as Element).releasePointerCapture?.(e.pointerId);
            setDragStartPos(null);
        }
    };

    // Handle wall node dragging
    const handleWallNodePointerDown = (e: React.PointerEvent, nodeId: string, type: 'wall_node' | 'stair') => {
        if (editingMode !== 'move' && interactionMode !== 'move-node') return;
        e.stopPropagation();
        setDraggingNodeId(nodeId);
        if (svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            setDragNodeStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
        (e.target as Element).setPointerCapture(e.pointerId);
    };

    const handleWallNodePointerMove = (e: React.PointerEvent) => {
        if (!draggingNodeId || !svgRef.current || !renderData) return;

        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (dragNodeStart) {
            const dx = (x - dragNodeStart.x) / scale;
            const dy = (y - dragNodeStart.y) / scale;

            const node = activeLayout?.nodes.find(n => n.id === draggingNodeId);
            if (node) {
                const pos = node.position || node.centroid || { x: 0, y: 0 };
                updateNodePosition(draggingNodeId, pos.x + dx, pos.y + dy);
            }
        }
        setDragNodeStart({ x, y });
    };

    const handleWallNodePointerUp = (e: React.PointerEvent) => {
        if (draggingNodeId) {
            (e.target as Element).releasePointerCapture?.(e.pointerId);
            setDraggingNodeId(null);
            setDragNodeStart(null);
        }
    };

    return (
        <div ref={containerRef} className="w-full h-full relative group">
            <svg
                ref={svgRef}
                viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
                className="w-full h-full"
                style={{ filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.5))' }}
                onPointerMove={handleWallNodePointerMove}
                onPointerUp={handleWallNodePointerUp}
            >
                <defs>
                    <pattern id="stairHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="8" height="8" fill="rgba(255, 255, 255, 0.05)" />
                        <path d="M 0,0 L 0,8" stroke="#f87171" strokeWidth="1" opacity="0.6" />
                    </pattern>
                    <pattern id="hatch-front" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(251,146,60,0.35)" strokeWidth="3" />
                    </pattern>
                    <pattern id="hatch-side" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(96,165,250,0.3)" strokeWidth="2" />
                    </pattern>
                    <pattern id="hatch-rear" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(74,222,128,0.3)" strokeWidth="2" />
                    </pattern>
                </defs>

                {/* ── LAYER 0: Lot background ── */}
                <rect
                    x={lotRect.left} y={lotRect.top}
                    width={lotRect.right - lotRect.left}
                    height={lotRect.bottom - lotRect.top}
                    fill="rgba(255,255,255,0.012)"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="1.5"
                    strokeDasharray="12 6"
                    rx="2"
                />

                {/* ── LAYER 1: Setback zones ── */}
                {zones.map((z, i) => {
                    const patternId = i === 0 ? 'url(#hatch-front)'
                        : i === 1 && rSvg > 0 ? 'url(#hatch-rear)'
                            : 'url(#hatch-side)';
                    return (
                        <g key={i}>
                            <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={z.color} />
                            <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={patternId} />
                            {/* Dimension label */}
                            {z.h > 14 && z.w > 14 && (
                                <text
                                    x={z.labelX} y={z.labelY}
                                    textAnchor={z.labelAnchor as any}
                                    dominantBaseline="middle"
                                    fontSize={Math.max(10, Math.min(18, Math.min(z.w, z.h) * 0.3))}
                                    fill="rgba(255,255,255,0.35)"
                                    fontFamily="monospace"
                                    fontWeight="bold"
                                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                                >
                                    {i === 0 ? `${frontSetback.toFixed(1)}m`
                                        : i === 1 && rSvg > 0 ? `${rearSetback.toFixed(1)}m`
                                            : `${sideSetback.toFixed(1)}m`}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* ── LAYER 2: Buildable envelope (inner dashed) ── */}
                <rect
                    x={bx1} y={by1}
                    width={bx2 - bx1} height={by2 - by1}
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="1"
                    strokeDasharray="6 4"
                />

                {/* ── LAYER 3: Floor plan geometry ── */}
                {activeFloor === 'ground' && DRAW_ORDER.map(cat => {
                    const geom = geojson.categories[cat];
                    if (!geom) return null;
                    const style = CATEGORY_STYLES[cat] || { fill: 'rgba(255,255,255,0.05)', stroke: '#444' };

                    const d = toSvgPath(geom);
                    const isSelected = selectedNodeId?.startsWith(cat);
                    // Disable hover effect - it was highlighting all elements of same type
                    const isHovered = false;

                    const actualFill = showColors ? style.fill : (cat === 'wall' ? 'none' : 'rgba(255,255,255,0.02)');
                    const actualStroke = showColors ? style.stroke : (cat === 'wall' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.15)');
                    const strokeW = cat === 'wall' ? (geojson.wall_width * scale * 2).toFixed(2) : '1';

                    return (
                        <path
                            key={cat}
                            d={d}
                            fill={actualFill}
                            stroke={actualStroke}
                            strokeWidth={strokeW}
                            fillOpacity={isSelected ? 1 : (showColors ? 0.85 : 1)}
                            className={`transition-colors duration-300 ${editingMode === 'move' && cat === 'stair' ? 'cursor-move' : 'cursor-pointer'}`}
                            onClick={() => setSelectedNodeId(cat)}
                            onPointerDown={(e) => handlePointerDown(e, cat)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            style={{ filter: isSelected ? 'brightness(1.5) drop-shadow(0 0 8px rgba(255,255,255,0.2))' : 'none' }}
                        />
                    );
                })}

                {/* ── LAYER 4: Inner boundary dash ── */}
                {activeFloor === 'ground' && geojson.inner && (
                    <path
                        d={toSvgPath(geojson.inner)}
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeDasharray="10 10"
                        opacity="0.15"
                    />
                )}

                {/* ── LAYER 5: Wall Graph (walls + room polygons + draggable nodes) ── */}
                <WallGraphLayer
                    scale={scale}
                    offsetX={offsetX}
                    offsetY={offsetY}
                    activeFloor={activeFloor}
                    handlePointerDown={handleWallNodePointerDown}
                />

                {/* ── LAYER 6: Room labels (overlay on top of walls) ── */}
                {activeFloor === 'ground' && (() => {
                    // Use rooms array if available (new wall graph format), otherwise fall back to nodes (legacy format)
                    const entities = activeLayout.rooms || activeLayout.nodes;
                    const isLegacyFormat = !activeLayout.rooms;
                    const totalRawArea = entities.reduce((sum, entity) => sum + (typeof entity.area === 'number' ? entity.area : 0), 0);
                    const totalRealArea = activeLayout.total_area_m2 || 1;
                    return entities
                        .filter(entity => entity.type !== 'wall_node' && entity.type !== 'stair')
                        .map(entity => {
                            if (entity.type === 'wall_node' || entity.type === 'stair') return null;

                            const pos = entity.position || entity.centroid || { x: 0, y: 0 };
                            const x = (pos.x + offsetX) * scale;
                            const y = (pos.y + offsetY) * scale;
                            const isSelected = selectedNodeId === entity.id || selectedNodeId === entity.type.toLowerCase();
                            const realArea = (typeof entity.area === 'number' && totalRawArea > 0)
                                ? (entity.area / totalRawArea) * totalRealArea : null;
                            return (
                                <g key={entity.id} className="pointer-events-none">
                                    {/* Only show selection circle for new wall graph format, not legacy */}
                                    <circle cx={x} cy={y - 12} r={isSelected && !isLegacyFormat ? 18 : 0}
                                        fill="white" fillOpacity={isSelected && !isLegacyFormat ? 0.2 : 0} className="transition-all" />
                                    <text x={x} y={y - 8} textAnchor="middle"
                                        className={`text-[18px] font-bold uppercase tracking-widest transition-colors ${isSelected ? 'fill-white' : 'fill-white/60'}`}
                                        style={{ pointerEvents: 'none', userSelect: 'none' }}>
                                        {entity.type}
                                    </text>
                                    <text x={x} y={y + 14} textAnchor="middle"
                                        className={`text-[14px] font-medium tracking-wider transition-colors ${isSelected ? 'fill-indigo-300' : 'fill-white/30'}`}
                                        style={{ pointerEvents: 'none', userSelect: 'none' }}>
                                        {realArea !== null ? realArea.toFixed(1) : '?'} m²
                                    </text>
                                </g>
                            );
                        });
                })()}

                {/* ── LAYER 6: Entrance arrow ── */}
                {fSvg > 4 && (
                    <g transform={`translate(${entrance.x}, ${entrance.y}) rotate(${entrance.rotation})`}
                        style={{ pointerEvents: 'none' }}>
                        {/* glow */}
                        <polygon points={arrowPts}
                            fill="rgba(251,146,60,0.15)" stroke="rgba(251,146,60,0.4)"
                            strokeWidth="1.5" strokeLinejoin="round" />
                        <polygon points={arrowPts}
                            fill="rgba(251,146,60,0.7)" stroke="rgba(251,146,60,0.9)"
                            strokeWidth="1" strokeLinejoin="round" />
                        {/* "STREET" label above arrow */}
                        <text
                            x={0} y={-arrowSize - 7}
                            textAnchor="middle"
                            fontSize={Math.max(9, arrowSize * 0.55)}
                            fill="rgba(251,146,60,0.7)"
                            fontFamily="monospace"
                            fontWeight="bold"
                            letterSpacing="1"
                            style={{ userSelect: 'none' }}
                        >
                            STREET
                        </text>
                    </g>
                )}

                {/* ── LAYER 7: Setback legend pills ── */}
                {[
                    { color: 'rgba(251,146,60,0.7)', label: `Front ${frontSetback.toFixed(1)}m` },
                    ...(sideSetback > 0 ? [{ color: 'rgba(96,165,250,0.7)', label: `Side ${sideSetback.toFixed(1)}m` }] : []),
                    ...(rearSetback > 0 ? [{ color: 'rgba(74,222,128,0.7)', label: `Rear ${rearSetback.toFixed(1)}m` }] : []),
                ].map((pill, i) => {
                    const pillX = lotRect.left + 6;
                    const pillY = lotRect.bottom + OUTER_PAD - 16 - i * 18;
                    return (
                        <g key={i} style={{ pointerEvents: 'none' }}>
                            <rect x={pillX} y={pillY - 8} width={8} height={8} rx="1" fill={pill.color} />
                            <text x={pillX + 11} y={pillY - 1}
                                fontSize="10" fill="rgba(255,255,255,0.4)"
                                fontFamily="monospace" style={{ userSelect: 'none' }}>
                                {pill.label}
                            </text>
                        </g>
                    );
                })}

                {/* ── LAYER 8: Compass Rose ── */}
                <g transform={`translate(${compassX}, ${compassY})`} style={{ pointerEvents: 'none' }}>
                    {/* background circle */}
                    <circle r={compassR + 4} fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                    {/* N indicator (always points to street) */}
                    {(['N', 'E', 'S', 'W'] as const).map(dir => {
                        const angle = (COMPASS_DIRS[siteParams.frontSide][dir] ?? 0) + 90;
                        const isNorth = dir === 'N';
                        const rad = (angle * Math.PI) / 180;
                        const tx = Math.cos(rad) * (compassR - 2);
                        const ty = Math.sin(rad) * (compassR - 2);
                        return (
                            <text key={dir} x={tx} y={ty}
                                textAnchor="middle" dominantBaseline="middle"
                                fontSize={isNorth ? 11 : 8}
                                fontWeight={isNorth ? 'bold' : 'normal'}
                                fill={isNorth ? 'rgba(251,146,60,0.9)' : 'rgba(255,255,255,0.35)'}
                                fontFamily="sans-serif"
                                style={{ userSelect: 'none' }}>
                                {dir}
                            </text>
                        );
                    })}
                    {/* arrow needle */}
                    {(() => {
                        const streetAngle = 0; // street is always "up" in compass = N labeled as street direction
                        const northAngle = (COMPASS_DIRS[siteParams.frontSide]['N'] ?? 0) + 90;
                        const rad = (northAngle * Math.PI) / 180;
                        const tip = { x: Math.cos(rad - Math.PI / 2) * (compassR * 0.55), y: Math.sin(rad - Math.PI / 2) * (compassR * 0.55) };
                        const base1 = { x: Math.cos(rad - Math.PI / 2 + 2.5) * 4, y: Math.sin(rad - Math.PI / 2 + 2.5) * 4 };
                        const base2 = { x: Math.cos(rad - Math.PI / 2 - 2.5) * 4, y: Math.sin(rad - Math.PI / 2 - 2.5) * 4 };
                        return (
                            <polygon
                                points={`${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`}
                                fill="rgba(251,146,60,0.8)" stroke="none"
                            />
                        );
                    })()}
                </g>

                {/* ── LAYER 9: Door/Window Placement ── */}
                <DoorWindowLayer
                    svgRef={svgRef}
                    containerBounds={containerBounds}
                    buildingBounds={renderData ? { minX: bx1, minY: by1, maxX: bx2, maxY: by2 } : null}
                />
            </svg>

            {/* Hover tooltip */}
            {hoveredRoomId && (
                <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold text-white uppercase tracking-widest">
                    {CATEGORY_STYLES[hoveredRoomId]?.label || hoveredRoomId}
                </div>
            )}
        </div>
    );
};

export default AxesFloorPlan;
