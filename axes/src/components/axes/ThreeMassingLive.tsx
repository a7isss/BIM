import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Environment, ContactShadows, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useAxesStore } from '../../store/useAxesStore';

// ── Shared Materials ─────────────────────────────────────────────────────────

const materials = {
    clay: new THREE.MeshStandardMaterial({
        color: '#fafafa',
        roughness: 0.9,
        metalness: 0.05,
        side: THREE.DoubleSide
    }),
    glass: new THREE.MeshPhysicalMaterial({
        color: '#7dd3fc',
        transmission: 0.8,
        opacity: 0.4,
        transparent: true,
        roughness: 0.05,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        thickness: 0.1,
        side: THREE.DoubleSide
    }),
    wood: new THREE.MeshStandardMaterial({
        color: '#8b7355',
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide
    }),
    floor: new THREE.MeshStandardMaterial({
        color: '#e4e4e7',
        roughness: 0.8,
        metalness: 0.0,
        side: THREE.DoubleSide
    })
};

// ── Shape Generator Helper ───────────────────────────────────────────────────

function createShapesFromCoordinates(coordinates: any[]): THREE.Shape[] {
    const shapes: THREE.Shape[] = [];

    const processRing = (ring: number[][]) => {
        const shape = new THREE.Shape();
        if (ring.length === 0) return shape;

        // Move to first point
        shape.moveTo(ring[0][0], ring[0][1]);

        // Line to subsequent points
        for (let i = 1; i < ring.length; i++) {
            shape.lineTo(ring[i][0], ring[i][1]);
        }

        // Close the path
        shape.closePath();
        return shape;
    };

    // Very naive MultiPolygon/Polygon handling based on array nesting depth
    const extractRings = (coords: any[]) => {
        if (!coords || !coords.length) return;

        // Is it an array of points? (Ring) -> [[x,y], [x,y]]
        if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            shapes.push(processRing(coords as number[][]));
            return;
        }

        // Otherwise recurse
        coords.forEach(extractRings);
    };

    extractRings(coordinates);
    return shapes;
}

// ── Extruded Feature Component ───────────────────────────────────────────────

const ExtrudedFeature: React.FC<{
    geometry: any;
    material: THREE.Material;
    depth: number;
    yOffset?: number;
    offsetX: number;
    offsetY: number;
    scale: number;
}> = ({ geometry, material, depth, yOffset = 0, offsetX, offsetY, scale }) => {

    // Convert GeoJSON geometry to THREE.Shapes
    const shapes = useMemo(() => {
        if (!geometry || !geometry.coordinates) return [];

        // We modify the coordinates with the same offset/scale logic
        const transformCoords = (coords: any): any => {
            if (Array.isArray(coords)) {
                if (typeof coords[0] === 'number') {
                    // Turn X/Y into X/Z by mapping: 
                    // SVG X -> 3D X
                    // SVG Y -> 3D -Z (to orient correctly)
                    const x = (coords[0] + offsetX) * scale;
                    const z = (coords[1] + offsetY) * scale;
                    // Because THREE.ExtrudeGeometry extrudes along Z, and draws shapes in XY,
                    // we draw the shape in XZ-plane equivalent by drawing in XY then rotating the mesh.
                    // So we provide X and Z as the 2D 'Y'.
                    return [x, z];
                }
                return coords.map(transformCoords);
            }
            return coords;
        };

        const transformed = transformCoords(geometry.coordinates);
        return createShapesFromCoordinates(transformed);
    }, [geometry, offsetX, offsetY, scale]);

    if (shapes.length === 0) return null;

    return (
        <group position={[0, yOffset, 0]}>
            {shapes.map((shape, idx) => (
                <mesh key={idx} material={material} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <extrudeGeometry args={[shape, { depth: depth, bevelEnabled: false }]} />
                </mesh>
            ))}
        </group>
    );
};

// ── Site Landmarks Component ───────────────────────────────────────────────────

const SiteLandmarks: React.FC = () => {
    const { activeLayout, siteParams, setbackOverrides } = useAxesStore();

    if (!activeLayout) return null;

    const defaultFront = Math.min(6, Math.max(3, siteParams.streetWidth / 5));
    const defaultSide = siteParams.isGroundFloor ? 0 : 2;
    const defaultRear = siteParams.isGroundFloor ? 0 : 2;

    const front = setbackOverrides.front !== null ? setbackOverrides.front : defaultFront;
    const side = setbackOverrides.side !== null ? setbackOverrides.side : defaultSide;
    const rear = setbackOverrides.rear !== null ? setbackOverrides.rear : defaultRear;

    const bx1 = -activeLayout.width_m / 2;
    const bx2 = activeLayout.width_m / 2;
    const by1 = -activeLayout.height_m / 2;
    const by2 = activeLayout.height_m / 2;

    let lotLeft = bx1, lotRight = bx2, lotTop = by1, lotBottom = by2;

    switch (siteParams.frontSide) {
        case 'north':
            lotTop -= front; lotBottom += rear;
            lotLeft -= side; lotRight += side;
            break;
        case 'south':
            lotTop -= rear; lotBottom += front;
            lotLeft -= side; lotRight += side;
            break;
        case 'east':
            lotLeft -= rear; lotRight += front;
            lotTop -= side; lotBottom += side;
            break;
        case 'west':
            lotLeft -= front; lotRight += rear;
            lotTop -= side; lotBottom += side;
            break;
    }

    const lotWidth = lotRight - lotLeft;
    const lotDepth = lotBottom - lotTop;
    const cx = lotLeft + lotWidth / 2;
    const cz = lotTop + lotDepth / 2;

    return (
        <group position={[cx, 0.01, cz]}>
            <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
                <edgesGeometry>
                    <planeGeometry args={[lotWidth, lotDepth]} />
                </edgesGeometry>
                <lineBasicMaterial color="#ef4444" linewidth={2} />
            </lineSegments>
            {/* Corner pins or dashed indicators could go here, for now it's just the red line */}
        </group>
    );
};

// ── Main Layout Scene ────────────────────────────────────────────────────────


const Scene: React.FC = () => {
    const { activeLayout, siteParams } = useAxesStore();

    // We compute the EXACT SAME offsets as AxesFloorPlan to ensure 1:1 alignment
    const renderData = useMemo(() => {
        const geojson = activeLayout?.floor_plan_geojson;
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
        const width = maxX - minX;
        const height = maxY - minY;

        // The new `generateGeoJSON` already outputs absolute real-world meters.
        // There is no more arbitrary pixel scaling needed. 1 unit = 1 meter.
        const isMeters = activeLayout?.nodes?.some((n: any) => n.dimensions) || Math.max(width, height) < 150;
        const scale = isMeters ? 1.0 : (20 / Math.max(width, height, 1));

        // We center the building at X=0, Z=0 for convenience
        const abstractWidth = maxX - minX;
        const offsetX = -minX - abstractWidth / 2;
        const offsetY = -minY - (maxY - minY) / 2;

        return { scale, offsetX, offsetY, minX, minY };
    }, [activeLayout]);

    if (!activeLayout || !renderData || !activeLayout.floor_plan_geojson_floors) return null;

    const { scale, offsetX, offsetY } = renderData;
    const floorsMap = activeLayout.floor_plan_geojson_floors;

    const ROOM_HEIGHT = 3.0;
    const DOOR_HEIGHT = 2.2;
    const WINDOW_SILL = 1.0;
    const WINDOW_HEAD = 2.4;
    const WINDOW_HEIGHT = WINDOW_HEAD - WINDOW_SILL;
    const STAIR_HEIGHT = ROOM_HEIGHT; // the stair block goes full height of room

    return (
        <group>
            {/* Site Environment */}
            <ambientLight intensity={0.6} />
            <directionalLight
                position={[20, 30, 10]}
                intensity={1}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-20}
                shadow-camera-right={20}
                shadow-camera-top={20}
                shadow-camera-bottom={-20}
            />

            {/* Solid Ground Plane (Beige/Paige) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color="#fdfbf7" roughness={1} />
            </mesh>

            {/* Lot Boundary (Red Landmarks) */}
            <SiteLandmarks />

            {/* Architectural Grid */}
            <Grid
                position={[0, -0.04, 0]}
                args={[100, 100]}
                cellSize={1}
                cellThickness={0.5}
                cellColor="#e4e4e7"
                sectionSize={5}
                sectionThickness={1}
                sectionColor="#a1a1aa"
                fadeDistance={50}
                fadeStrength={2}
            />

            {/* Shift everything by frontSetback? We keep the building centered for now to match the OrbitControls best focus */}
            <group>
                {(['ground', 'first', 'roof'] as const).map((floor, index) => {
                    const floorData = floorsMap[floor];
                    if (!floorData) return null;
                    const c = floorData.categories || {};
                    // Ground Y = 0, First Y = ROOM_HEIGHT, Roof Y = 2 * ROOM_HEIGHT
                    const baseY = index * ROOM_HEIGHT;

                    return (
                        <group key={floor} position={[0, baseY, 0]}>
                            {/* 1. Walls & Stairs */}
                            <ExtrudedFeature geometry={c.wall_3d || c.wall} material={materials.clay} depth={ROOM_HEIGHT} offsetX={offsetX} offsetY={offsetY} scale={scale} />
                            {c.stair && <ExtrudedFeature geometry={c.stair} material={materials.clay} depth={STAIR_HEIGHT} offsetX={offsetX} offsetY={offsetY} scale={scale} />}

                            {/* 2. Doors */}
                            {c.door && (
                                <>
                                    <ExtrudedFeature geometry={c.door} material={materials.wood} depth={DOOR_HEIGHT} offsetX={offsetX} offsetY={offsetY} scale={scale} />
                                    <ExtrudedFeature geometry={c.door} material={materials.clay} depth={ROOM_HEIGHT - DOOR_HEIGHT} yOffset={DOOR_HEIGHT} offsetX={offsetX} offsetY={offsetY} scale={scale} />
                                </>
                            )}
                            {c.front_door && (
                                <>
                                    <ExtrudedFeature geometry={c.front_door} material={materials.wood} depth={DOOR_HEIGHT} offsetX={offsetX} offsetY={offsetY} scale={scale} />
                                    <ExtrudedFeature geometry={c.front_door} material={materials.clay} depth={ROOM_HEIGHT - DOOR_HEIGHT} yOffset={DOOR_HEIGHT} offsetX={offsetX} offsetY={offsetY} scale={scale} />
                                </>
                            )}

                            {/* 3. Windows */}
                            {c.window && (
                                <>
                                    <ExtrudedFeature geometry={c.window} material={materials.clay} depth={WINDOW_SILL} offsetX={offsetX} offsetY={offsetY} scale={scale} />
                                    <ExtrudedFeature geometry={c.window} material={materials.glass} depth={WINDOW_HEIGHT} yOffset={WINDOW_SILL} offsetX={offsetX} offsetY={offsetY} scale={scale} />
                                    <ExtrudedFeature geometry={c.window} material={materials.clay} depth={ROOM_HEIGHT - WINDOW_HEAD} yOffset={WINDOW_HEAD} offsetX={offsetX} offsetY={offsetY} scale={scale} />
                                </>
                            )}

                            {/* 4. Floors / Slabs (living, bedroom, bathroom, kitchen, balcony) */}
                            {['living', 'bedroom', 'bathroom', 'kitchen', 'balcony'].map((catType) => {
                                if (!c[catType as keyof typeof c]) return null;
                                return (
                                    <ExtrudedFeature
                                        key={catType}
                                        geometry={c[catType as keyof typeof c]}
                                        material={materials.floor}
                                        depth={0.1}
                                        yOffset={0}
                                        offsetX={offsetX}
                                        offsetY={offsetY}
                                        scale={scale}
                                    />
                                );
                            })}

                            {/* Inner Envelope Outline Helper */}
                            {floorData.inner && (
                                <ExtrudedFeature
                                    geometry={floorData.inner}
                                    material={materials.glass}
                                    depth={ROOM_HEIGHT + 0.1}
                                    yOffset={-0.05}
                                    offsetX={offsetX}
                                    offsetY={offsetY}
                                    scale={scale}
                                />
                            )}
                        </group>
                    );
                })}
            </group>

            {/* Soft ground shadows */}
            <ContactShadows resolution={1024} scale={50} blur={2} opacity={0.5} far={10} color="#000000" />
            <Environment preset="city" />

            <OrbitControls
                makeDefault
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                maxPolarAngle={Math.PI / 2 - 0.05} // don't go below ground
                minDistance={5}
                maxDistance={100}
                dampingFactor={0.1}
            />
        </group>
    );
};

// ── Main UI Component ────────────────────────────────────────────────────────

const ThreeMassingLive: React.FC = () => {
    const { activeLayout } = useAxesStore();

    if (!activeLayout) {
        return (
            <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-black rounded-xl flex items-center justify-center">
                <div className="text-zinc-600 font-medium italic">Select a layout to view 3D massing</div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-gradient-to-br from-zinc-900 to-black rounded-xl flex items-center justify-center overflow-hidden">
            <div className="absolute top-4 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg px-4 py-2 border border-white/10 shadow-lg">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    3D Massing Extrusion
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">Real-time architectural volumes</div>
            </div>

            <Canvas shadows camera={{ position: [15, 15, 20], fov: 45 }} className="w-full h-full">
                <Suspense fallback={<Html center><div className="text-white text-sm">Loading Geometry...</div></Html>}>
                    <Scene />
                </Suspense>
            </Canvas>
        </div>
    );
};

export default ThreeMassingLive;