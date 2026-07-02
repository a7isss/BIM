import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Environment, ContactShadows, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useResPlanData } from '../hooks/useResPlanData';
import type { Node, Element, Slab, ArchitectureLine, Level } from '../types';

// ── Shared Materials ─────────────────────────────────────────────────────────

const materials = {
    node: new THREE.MeshStandardMaterial({ color: '#22d3ee', roughness: 0.3, metalness: 0.6 }),
    column: new THREE.MeshStandardMaterial({ color: '#6366f1', roughness: 0.4, metalness: 0.3 }),
    beam: new THREE.MeshStandardMaterial({ color: '#a78bfa', roughness: 0.4, metalness: 0.3 }),
    slab: new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.7, metalness: 0.1, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    wall: new THREE.MeshStandardMaterial({ color: '#e4e4e7', roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide }),
    ground: new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 1 }),
};

// ── Helper: node lookup map ──────────────────────────────────────────────────

function useNodeMap(nodes: Node[]) {
    return useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
}

// ── Node Markers ─────────────────────────────────────────────────────────────

function NodeMarkers({ nodes }: { nodes: Node[] }) {
    const mat = materials.node;
    return (
        <group>
            {nodes.map(n => (
                <mesh key={n.id} position={[n.x, (n.z || 0) + 0.05, n.y]} material={mat}>
                    <sphereGeometry args={[0.08, 8, 8]} />
                </mesh>
            ))}
        </group>
    );
}

// ── Columns ──────────────────────────────────────────────────────────────────

function Columns({ elements, nodeMap, levels }: { elements: Element[]; nodeMap: Map<any, Node>; levels: { architectural: Level[]; structural: Level[] } }) {
    const allLevels = useMemo(() => [...levels.architectural, ...levels.structural], [levels]);
    const meshes = useMemo(() => {
        return elements
            .filter(el => el.type === 'column' && el.node_id != null)
            .map(el => {
                const node = nodeMap.get(el.node_id!);
                if (!node) return null;
                const level = allLevels.find(l => l.id === el.level_id);
                const elevation = level?.elevation_m ?? 0;
                const floorHeight = level?.height_m ?? 3.0;
                const colHeight = el.length_m ?? floorHeight;
                const bw = el.b ?? 0.3;
                const bh = el.h ?? 0.3;
                return { x: node.x, z: node.y, y: elevation + colHeight / 2, w: bw, d: bh, h: colHeight };
            })
            .filter(Boolean);
    }, [elements, allLevels, nodeMap]);

    if (meshes.length === 0) return null;
    const mat = materials.column;
    return (
        <group>
            {meshes.map((m, i) => (
                <mesh key={i} position={[m.x, m.y, m.z]} material={mat}>
                    <boxGeometry args={[m.w, m.h, m.d]} />
                </mesh>
            ))}
        </group>
    );
}

// ── Beams ────────────────────────────────────────────────────────────────────

function Beams({ elements, nodeMap, levels }: { elements: Element[]; nodeMap: Map<any, Node>; levels: { architectural: Level[]; structural: Level[] } }) {
    const allLevels = useMemo(() => [...levels.architectural, ...levels.structural], [levels]);
    const meshes = useMemo(() => {
        return elements
            .filter(el => el.type === 'beam' && el.n1 != null && el.n2 != null)
            .map(el => {
                const n1 = nodeMap.get(el.n1!);
                const n2 = nodeMap.get(el.n2!);
                if (!n1 || !n2) return null;
                const level = allLevels.find(l => l.id === el.level_id);
                const elevation = level?.elevation_m ?? 0;
                const bw = el.b ?? 0.25;
                const bh = el.h ?? 0.4;
                const dx = n2.x - n1.x;
                const dz = n2.y - n1.y;
                const length = Math.sqrt(dx * dx + dz * dz);
                if (length < 0.001) return null;
                return {
                    mx: (n1.x + n2.x) / 2, mz: (n1.y + n2.y) / 2,
                    y: elevation + bh / 2, length, w: bw, h: bh,
                    angle: Math.atan2(dz, dx),
                };
            })
            .filter(Boolean);
    }, [elements, allLevels, nodeMap]);

    if (meshes.length === 0) return null;
    const mat = materials.beam;
    return (
        <group>
            {meshes.map((m, i) => (
                <mesh key={i} position={[m.mx, m.y, m.mz]} rotation={[0, m.angle, 0]} material={mat}>
                    <boxGeometry args={[m.length, m.h, m.w]} />
                </mesh>
            ))}
        </group>
    );
}

// ── Slabs ────────────────────────────────────────────────────────────────────

function SlabsView({ slabs, nodeMap }: { slabs: Slab[]; nodeMap: Map<any, Node> }) {
    const shapes = useMemo(() => {
        return slabs
            .filter(s => s.nodes && s.nodes.length >= 3)
            .map(s => {
                const pts = s.nodes!.map(id => nodeMap.get(id)).filter(Boolean) as Node[];
                if (pts.length < 3) return null;
                const shape = new THREE.Shape();
                shape.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
                shape.closePath();
                const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
                const cz = pts.reduce((a, p) => a + p.y, 0) / pts.length;
                return { shape, cx, cz, elevation: s.z_elevation ?? 0 };
            })
            .filter(Boolean);
    }, [slabs, nodeMap]);

    if (shapes.length === 0) return null;
    const mat = materials.slab;
    return (
        <group>
            {shapes.map((s, i) => (
                <mesh key={i} position={[s.cx, s.elevation, s.cz]} rotation={[-Math.PI / 2, 0, 0]} material={mat}>
                    <shapeGeometry args={[s.shape]} />
                </mesh>
            ))}
        </group>
    );
}

// ── Walls ────────────────────────────────────────────────────────────────────

function WallsView({ architecture, nodeMap, levels }: { architecture: ArchitectureLine[]; nodeMap: Map<any, Node>; levels: { architectural: Level[]; structural: Level[] } }) {
    const allLevels = useMemo(() => [...levels.architectural, ...levels.structural], [levels]);
    const segments = useMemo(() => {
        const result: Array<{ mx: number; mz: number; y: number; length: number; h: number; angle: number }> = [];
        architecture.forEach(arch => {
            const level = allLevels.find(l => l.id === arch.level_id);
            const elevation = level?.elevation_m ?? 0;
            const floorHeight = level?.height_m ?? 3.0;

            if (arch.coordinates && arch.coordinates.length >= 2) {
                for (let i = 0; i < arch.coordinates.length - 1; i++) {
                    const [x1, y1] = arch.coordinates[i];
                    const [x2, y2] = arch.coordinates[i + 1];
                    const dx = x2 - x1;
                    const dz = y2 - y1;
                    const len = Math.sqrt(dx * dx + dz * dz);
                    if (len < 0.01) continue;
                    result.push({
                        mx: (x1 + x2) / 2, mz: (y1 + y2) / 2,
                        y: elevation + floorHeight / 2, length: len, h: floorHeight,
                        angle: Math.atan2(dz, dx),
                    });
                }
            } else if (arch.n1 != null && arch.n2 != null) {
                const n1 = nodeMap.get(arch.n1);
                const n2 = nodeMap.get(arch.n2);
                if (!n1 || !n2) return;
                const dx = n2.x - n1.x;
                const dz = n2.y - n1.y;
                const len = Math.sqrt(dx * dx + dz * dz);
                if (len < 0.01) return;
                result.push({
                    mx: (n1.x + n2.x) / 2, mz: (n1.y + n2.y) / 2,
                    y: elevation + floorHeight / 2, length: len, h: floorHeight,
                    angle: Math.atan2(dz, dx),
                });
            }
        });
        return result;
    }, [architecture, allLevels, nodeMap]);

    if (segments.length === 0) return null;
    const mat = materials.wall;
    return (
        <group>
            {segments.map((s, i) => (
                <mesh key={i} position={[s.mx, s.y, s.mz]} rotation={[0, s.angle, 0]} material={mat}>
                    <boxGeometry args={[s.length, s.h, 0.15]} />
                </mesh>
            ))}
        </group>
    );
}

// ── Scene ────────────────────────────────────────────────────────────────────

function Scene() {
    const { nodes, elements, slabs, architecture, levels, settings } = useResPlanData();

    const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

    const center = useMemo(() => {
        if (nodes.length === 0) return { x: 0, z: 0 };
        const xs = nodes.map(n => n.x);
        const zs = nodes.map(n => n.y);
        return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
    }, [nodes]);

    const defaultFloorHeight = settings?.floor_height_m ?? 3.0;
    const maxHeight = useMemo(() => {
        const allHeights = [...levels.architectural, ...levels.structural]
            .map(l => (l.elevation_m ?? 0) + (l.height_m ?? defaultFloorHeight));
        return Math.max(...allHeights, 4);
    }, [levels, defaultFloorHeight]);

    return (
        <group position={[-center.x, 0, -center.z]}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[20, 30, 10]} intensity={1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow material={materials.ground}>
                <planeGeometry args={[100, 100]} />
            </mesh>

            <Grid position={[0, -0.04, 0]} args={[100, 100]} cellSize={1} cellThickness={0.5} cellColor="#e4e4e7" sectionSize={5} sectionThickness={1} sectionColor="#a1a1aa" fadeDistance={50} fadeStrength={2} />

            <WallsView architecture={architecture} nodeMap={nodeMap} levels={levels} />
            <Columns elements={elements} nodeMap={nodeMap} levels={levels} />
            <Beams elements={elements} nodeMap={nodeMap} levels={levels} />
            <SlabsView slabs={slabs} nodeMap={nodeMap} />
            <NodeMarkers nodes={nodes} />

            <ContactShadows resolution={1024} scale={50} blur={2} opacity={0.5} far={10} color="#000000" />
            <Environment preset="city" />

            <OrbitControls makeDefault enablePan enableZoom enableRotate maxPolarAngle={Math.PI / 2 - 0.05} minDistance={1} maxDistance={100} dampingFactor={0.1} target={[0, maxHeight / 2, 0]} />
        </group>
    );
}

// ── Main Component ───────────────────────────────────────────────────────────

const ThreeResPlanScene: React.FC = () => {
    return (
        <div className="relative w-full h-full bg-gradient-to-br from-zinc-900 to-black rounded-xl flex items-center justify-center overflow-hidden">
            <div className="absolute top-4 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg px-4 py-2 border border-white/10 shadow-lg">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    3D Structural View
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">Columns / Beams / Slabs / Walls</div>
            </div>
            <Canvas shadows camera={{ position: [15, 15, 20], fov: 45 }} className="w-full h-full">
                <Scene />
            </Canvas>
        </div>
    );
};

export default ThreeResPlanScene;
