import { create } from 'zustand';
import { extractDoorsFromGeoJSON, extractWindowsFromGeoJSON } from '../components/axes/editors/geojsonUtils';
import { generateGeoJSON } from '../components/axes/editors/generateGeoJSON';

// ── Type Definitions ─────────────────────────────────────────────────────────

export interface Node {
    id: string;
    type: string;
    label?: string;
    area: number;
    position: { x: number; y: number };
    dimensions?: { width: number; height: number };
    centroid?: { x: number; y: number };
    bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface Link {
    source: string;
    target: string;
    type: string;
}

export interface Door {
    id: string;
    position: { x: number; y: number };
    rotation: number; // 0, 90, 180, 270
    width: number; // default 0.9m
    wallSide: 'north' | 'south' | 'east' | 'west';
    linkedRooms?: [string, string]; // [from_room, to_room]
}

export interface Window {
    id: string;
    position: { x: number; y: number };
    rotation: number;
    width: number; // default 1.2m
    wallSide: 'north' | 'south' | 'east' | 'west';
    room?: string; // parent room
}

export interface Stair {
    id: string;
    position: { x: number; y: number };
    rotation: number; // 0, 90, 180, 270
    width: number; // default 2.5m
    length: number; // default 5.5m
}

export interface ParsedPlan {
    nodes: Node[];
    links: Link[];
    rooms?: any[];
    doors: Door[];
    windows: Window[];
    stairs: Stair[];
    bounds: { width: number; height: number };
    metrics: { totalArea: number };
    geojson?: any;
}

// ── Main State Interface ─────────────────────────────────────────────────────

interface AxesState {
    // Existing Layout State
    activeLayout: {
        id: string;
        nodes: Node[];
        links: Link[];
        rooms?: any[];
        total_area_m2: number;
        width_m: number;
        height_m: number;
        floor_plan_geojson?: any;
        floor_plan_geojson_floors?: {
            ground: any;
            first: any;
            roof: any;
        };
        room_types?: string[];
        // NEW: User-edited elements
        doors?: Door[];
        windows?: Window[];
        stairs?: Stair[];
    } | null;
    selectedNodeId: string | null;
    hoveredNodeId: string | null;

    // NEW: Selection for doors/windows
    selectedDoorId: string | null;
    selectedWindowId: string | null;
    selectedStairId: string | null;
    selectedLinkId: string | null;

    // Site Parameters
    siteParams: {
        lotWidth: number;
        lotDepth: number;
        streetWidth: number;
        frontSide: 'north' | 'south' | 'east' | 'west';
        isGroundFloor: boolean;
    };

    // NEW: Interaction Mode (expanded from editingMode)
    interactionMode: 'select' | 'move-node' | 'move-stair' | 'place-door' | 'place-window' | 'drag-door' | 'drag-window';
    editingMode: 'select' | 'move' | 'resize'; // Keep for backward compatibility
    viewMode: 'split' | '2d' | '3d';

    // Export Settings
    exportSettings: {
        cameraAngle: 'front' | 'perspective' | 'top' | 'isometric';
        resolution: 'hd' | '4k' | 'print';
        includeDimensions: boolean;
    };

    // Briefing Room
    briefingRoom: {
        targetArea: number;
        selectedRoomTypes: string[];
        quickPreset: string | null;
    };

    // Layout Search State
    isSearching: boolean;
    searchError: string | null;
    matchFound: boolean;

    // Interior Generation
    axesInteriorTheme: string;
    axesInteriorPaletteId: string;
    axesDoorCount: number;
    axesWindowCount: number;
    axesTimeOfDay: string;
    axesGeneratedInterior: string | null;
    axesIsGenerating: boolean;
    axesCanvasSnapshot: string | null;

    // Dirty State
    isDirty: boolean;

    // NEW: Save State
    lastSavedAt: Date | null;
    hasUnsavedChanges: boolean;
    saveStatus: 'saved' | 'unsaved' | 'saving' | 'error';
    currentPlanId: string | null; // For loading/saving

    // Setback Overrides
    setbackOverrides: {
        front: number | null;
        side: number | null;
        rear: number | null;
    };

    // Keyboard Shortcuts
    shortcutsEnabled: boolean;

    // ── Actions ───────────────────────────────────────────────────────────────

    // Layout Actions
    setActiveLayout: (layout: any) => void;
    setSelectedNodeId: (id: string | null) => void;
    setHoveredNodeId: (id: string | null) => void;
    updateNodePosition: (id: string, x: number, y: number) => void;

    // Site Actions
    setSiteParams: (params: Partial<AxesState['siteParams']>) => void;

    // Mode Actions
    setEditingMode: (mode: 'select' | 'move' | 'resize') => void;
    setInteractionMode: (mode: AxesState['interactionMode']) => void;
    setViewMode: (mode: 'split' | '2d' | '3d') => void;
    setExportSettings: (settings: Partial<AxesState['exportSettings']>) => void;
    setBriefingRoom: (params: Partial<AxesState['briefingRoom']>) => void;

    // Search Actions
    setIsSearching: (v: boolean) => void;
    setSearchError: (msg: string | null) => void;
    setMatchFound: (v: boolean) => void;

    // Selection Actions
    setSelectedDoorId: (id: string | null) => void;
    setSelectedWindowId: (id: string | null) => void;
    setSelectedStairId: (id: string | null) => void;
    setSelectedLinkId: (id: string | null) => void;

    // Interior Actions
    setAxesInteriorTheme: (theme: string) => void;
    setAxesInteriorPaletteId: (id: string) => void;
    setAxesDoorCount: (count: number) => void;
    setAxesWindowCount: (count: number) => void;
    setAxesTimeOfDay: (time: string) => void;
    setAxesGeneratedInterior: (image: string | null) => void;
    setAxesIsGenerating: (loading: boolean) => void;
    setAxesCanvasSnapshot: (snapshot: string | null) => void;

    // Dirty State Actions
    setIsDirty: (v: boolean) => void;
    setSetbackOverrides: (overrides: Partial<AxesState['setbackOverrides']>) => void;

    // NEW: Door Actions
    addDoor: (door: Omit<Door, 'id'>) => void;
    updateDoorPosition: (id: string, pos: { x: number; y: number }) => void;
    rotateDoor: (id: string) => void;
    removeDoor: (id: string) => void;

    // NEW: Window Actions
    addWindow: (window: Omit<Window, 'id'>) => void;
    updateWindowPosition: (id: string, pos: { x: number; y: number }) => void;
    rotateWindow: (id: string) => void;
    removeWindow: (id: string) => void;

    // NEW: Stair Actions
    rotateStair: (id: string) => void;
    updateStairPosition: (dx: number, dy: number) => void;

    // NEW: Save/Load Actions
    triggerAutoSave: () => void;
    manualSave: () => Promise<void>;
    loadPlan: (planId: string) => Promise<void>;
    setSaveStatus: (status: AxesState['saveStatus']) => void;
    setShortcutsEnabled: (enabled: boolean) => void;
}

// ── Helper Functions ─────────────────────────────────────────────────────────

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Round coordinates to 3 decimal places (~1mm precision) to prevent floating point drift
const ROUND = (n: number) => Math.round(n * 1000) / 1000;

// Auto-merge nearby wall nodes (handles CubiCasa room coordinate gaps)
function optimizeWallGraph(nodes: Node[], links: Link[], rooms: any[], mergeDist: number = 0.35) {
    if (!nodes || nodes.length === 0) return;

    let merged = true;
    while (merged) {
        merged = false;
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].type !== 'wall_node') continue;
            const p1 = nodes[i].position || nodes[i].centroid;
            if (!p1) continue;

            for (let j = i + 1; j < nodes.length; j++) {
                if (nodes[j].type !== 'wall_node') continue;
                const p2 = nodes[j].position || nodes[j].centroid;
                if (!p2) continue;

                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < mergeDist) {
                    // Merge j into i
                    const idToKeep = nodes[i].id;
                    const idToRemove = nodes[j].id;

                    // Average position
                    p1.x = ROUND((p1.x + p2.x) / 2);
                    p1.y = ROUND((p1.y + p2.y) / 2);
                    nodes[i].position = { x: p1.x, y: p1.y };
                    nodes[i].centroid = { x: p1.x, y: p1.y };

                    // Update links
                    links.forEach(l => {
                        if (l.source === idToRemove) l.source = idToKeep;
                        if (l.target === idToRemove) l.target = idToKeep;
                    });

                    // Update rooms
                    if (rooms) {
                        rooms.forEach(r => {
                            if (r.wall_nodes) {
                                r.wall_nodes = r.wall_nodes.map((nid: string) => nid === idToRemove ? idToKeep : nid);
                                // Remove consecutive duplicates
                                r.wall_nodes = r.wall_nodes.filter((nid: string, idx: number, arr: string[]) =>
                                    idx === 0 || nid !== arr[idx - 1]
                                );
                            }
                        });
                    }

                    // Remove j
                    nodes.splice(j, 1);
                    merged = true;
                    break;
                }
            }
            if (merged) break; // Restart outer loop
        }
    }

    // Clean up duplicate links
    const seenLinks = new Set<string>();
    for (let i = links.length - 1; i >= 0; i--) {
        const l = links[i];
        if (l.source === l.target) {
            links.splice(i, 1); // self loop
            continue;
        }
        const key = [l.source, l.target].sort().join('-');
        if (seenLinks.has(key)) {
            links.splice(i, 1);
        } else {
            seenLinks.add(key);
        }
    }
}


// ── Store Implementation ─────────────────────────────────────────────────────

export const useAxesStore = create<AxesState>((set, get) => ({
    // Initial State
    activeLayout: null,
    selectedNodeId: null,
    hoveredNodeId: null,
    selectedDoorId: null,
    selectedWindowId: null,
    selectedStairId: null,
    selectedLinkId: null,

    siteParams: {
        lotWidth: 20,
        lotDepth: 30,
        streetWidth: 15,
        frontSide: 'north',
        isGroundFloor: true,
    },

    interactionMode: 'select',
    editingMode: 'select',
    viewMode: 'split',
    exportSettings: {
        cameraAngle: 'perspective',
        resolution: 'hd',
        includeDimensions: true,
    },
    briefingRoom: {
        targetArea: 300,
        selectedRoomTypes: [],
        quickPreset: null,
    },

    isSearching: false,
    searchError: null,
    matchFound: false,

    axesInteriorTheme: 'modern',
    axesInteriorPaletteId: 'neutral',
    axesDoorCount: 1,
    axesWindowCount: 2,
    axesTimeOfDay: 'Day',
    axesGeneratedInterior: null,
    axesIsGenerating: false,
    axesCanvasSnapshot: null,
    isDirty: false,

    // Save State
    lastSavedAt: null,
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    currentPlanId: null,

    setbackOverrides: {
        front: null,
        side: null,
        rear: null,
    },

    shortcutsEnabled: true,

    // ── Actions Implementation ────────────────────────────────────────────────

    setActiveLayout: (layout) => set((state) => {
        if (!layout) return {
            activeLayout: null,
            selectedNodeId: null,
            selectedDoorId: null,
            selectedWindowId: null,
            selectedStairId: null,
            isDirty: false,
            setbackOverrides: { front: null, side: null, rear: null },
            hasUnsavedChanges: false,
            saveStatus: 'saved' as const
        };

        const clone = JSON.parse(JSON.stringify(layout));

        // Initialize doors/windows/stairs arrays if not present
        if (!clone.doors) clone.doors = [];
        if (!clone.windows) clone.windows = [];
        if (!clone.stairs) clone.stairs = [];

        // NEW: Extract doors/windows from GeoJSON if arrays are empty
        // This handles loading old plans that only have GeoJSON format
        if (clone.doors.length === 0 && clone.floor_plan_geojson) {
            const extractedDoors = extractDoorsFromGeoJSON(clone.floor_plan_geojson);
            if (extractedDoors.length > 0) {
                clone.doors = extractedDoors;
            }
        }
        if (clone.windows.length === 0 && clone.floor_plan_geojson) {
            const extractedWindows = extractWindowsFromGeoJSON(clone.floor_plan_geojson);
            if (extractedWindows.length > 0) {
                clone.windows = extractedWindows;
            }
        }

        // Optimize the wall graph topology before generating GeoJSON
        optimizeWallGraph(clone.nodes, clone.links, clone.rooms);

        // Existing stair injection logic (preserved)
        // Wait wait, we generate the geojson completely dynamically from our nodes!
        // We do not want to rely on the static payload from DB anymore.
        let generatedGeoJSON = generateGeoJSON(clone.nodes, clone.links, clone.doors, clone.windows, clone.stairs, 0.2, clone.rooms, clone.floor_plan_geojson);

        const ground = generatedGeoJSON;
        const first = JSON.parse(JSON.stringify(ground));
        if (first.categories.front_door) delete first.categories.front_door;

        const roof = {
            categories: {
                wall: ground.categories.wall,
                stair: ground.categories.stair
            }
        };

        clone.floor_plan_geojson_floors = { ground, first, roof };


        return {
            activeLayout: clone,
            selectedNodeId: null,
            selectedDoorId: null,
            selectedWindowId: null,
            selectedStairId: null,
            isDirty: false,
            setbackOverrides: { front: null, side: null, rear: null },
            hasUnsavedChanges: false,
            saveStatus: 'saved' as const
        };
    }),

    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    setHoveredNodeId: (id) => set({ hoveredNodeId: id }),
    setSelectedDoorId: (id) => set({ selectedDoorId: id }),
    setSelectedWindowId: (id) => set({ selectedWindowId: id }),
    setSelectedStairId: (id) => set({ selectedStairId: id }),
    setSelectedLinkId: (id) => set({ selectedLinkId: id }),

    setSiteParams: (params) => set((state) => ({
        siteParams: { ...state.siteParams, ...params }
    })),

    updateNodePosition: (id, x, y) => set((state) => {
        if (!state.activeLayout) return state;
        const newNodes = state.activeLayout.nodes.map(n =>
            n.id === id ? { ...n, position: { x: ROUND(x), y: ROUND(y) }, centroid: { x: ROUND(x), y: ROUND(y) } } : n
        );

        const newGeoJSON = generateGeoJSON(newNodes, state.activeLayout.links, state.activeLayout.doors, state.activeLayout.windows, state.activeLayout.stairs, 0.2, state.activeLayout.rooms, state.activeLayout.floor_plan_geojson);

        const newFloors = {
            ground: newGeoJSON,
            first: { ...newGeoJSON, categories: { ...newGeoJSON.categories } },
            roof: { categories: { wall: newGeoJSON.categories.wall, stair: newGeoJSON.categories.stair } }
        };
        if (newFloors.first.categories.front_door) delete newFloors.first.categories.front_door;

        return {
            activeLayout: { ...state.activeLayout, floor_plan_geojson_floors: newFloors, nodes: newNodes },
            isDirty: true,
            hasUnsavedChanges: true,
            saveStatus: 'unsaved' as const
        };
    }),

    updateStairPosition: (dx, dy) => set((state) => {
        if (!state.activeLayout || !state.activeLayout.floor_plan_geojson_floors) return state;

        const newNodes = state.activeLayout.nodes.map(n => {
            if (n.type !== 'stair') return n;
            const px = n.position ? n.position.x : n.centroid?.x || 0;
            const py = n.position ? n.position.y : n.centroid?.y || 0;
            return { ...n, position: { x: ROUND(px + dx), y: ROUND(py + dy) }, centroid: { x: ROUND(px + dx), y: ROUND(py + dy) } };
        });

        const newGeoJSON = generateGeoJSON(newNodes, state.activeLayout.links, state.activeLayout.doors, state.activeLayout.windows, state.activeLayout.stairs, 0.2, state.activeLayout.rooms, state.activeLayout.floor_plan_geojson);

        const newFloors = {
            ground: newGeoJSON,
            first: { ...newGeoJSON, categories: { ...newGeoJSON.categories } },
            roof: { categories: { wall: newGeoJSON.categories.wall, stair: newGeoJSON.categories.stair } }
        };
        if (newFloors.first.categories.front_door) delete newFloors.first.categories.front_door;

        return {
            activeLayout: { ...state.activeLayout, floor_plan_geojson_floors: newFloors, nodes: newNodes },
            isDirty: true,
            hasUnsavedChanges: true,
            saveStatus: 'unsaved' as const
        };
    }),

    setEditingMode: (mode) => set({ editingMode: mode }),
    setInteractionMode: (mode) => set({ interactionMode: mode }),
    setViewMode: (mode) => set({ viewMode: mode }),
    setExportSettings: (settings) => set((state) => ({
        exportSettings: { ...state.exportSettings, ...settings }
    })),
    setBriefingRoom: (params) => set((state) => ({
        briefingRoom: { ...state.briefingRoom, ...params }
    })),
    setIsSearching: (v) => set({ isSearching: v }),
    setSearchError: (msg) => set({ searchError: msg }),
    setMatchFound: (v) => set({ matchFound: v }),

    setAxesInteriorTheme: (theme) => set({ axesInteriorTheme: theme }),
    setAxesInteriorPaletteId: (id) => set({ axesInteriorPaletteId: id }),
    setAxesDoorCount: (count) => set({ axesDoorCount: count }),
    setAxesWindowCount: (count) => set({ axesWindowCount: count }),
    setAxesTimeOfDay: (time) => set({ axesTimeOfDay: time }),
    setAxesGeneratedInterior: (image) => set({ axesGeneratedInterior: image }),
    setAxesIsGenerating: (loading) => set({ axesIsGenerating: loading }),
    setAxesCanvasSnapshot: (snapshot) => set({ axesCanvasSnapshot: snapshot }),
    setIsDirty: (v) => set({ isDirty: v }),
    setSetbackOverrides: (overrides) => set((state) => ({
        setbackOverrides: { ...state.setbackOverrides, ...overrides }
    })),
    setShortcutsEnabled: (enabled) => set({ shortcutsEnabled: enabled }),
    setSaveStatus: (status) => set({ saveStatus: status }),

    // ── NEW: Door Actions ─────────────────────────────────────────────────────

    addDoor: (door) => set((state) => {
        if (!state.activeLayout) return state;
        const newDoor: Door = {
            ...door,
            id: generateId(),
            width: door.width || 0.9,
            rotation: door.rotation || 0,
        };
        const existingDoors = state.activeLayout.doors || [];
        return {
            activeLayout: {
                ...state.activeLayout,
                doors: [...existingDoors, newDoor]
            },
            selectedDoorId: newDoor.id,
            isDirty: true,
            hasUnsavedChanges: true,
            saveStatus: 'unsaved' as const
        };
    }),

    updateDoorPosition: (id, pos) => set((state) => {
        if (!state.activeLayout || !state.activeLayout.doors) return state;
        const newDoors = state.activeLayout.doors.map(d =>
            d.id === id ? { ...d, position: { x: ROUND(pos.x), y: ROUND(pos.y) } } : d
        );
        return {
            activeLayout: { ...state.activeLayout, doors: newDoors },
            isDirty: true,
            hasUnsavedChanges: true,
            saveStatus: 'unsaved' as const
        };
    }),

    rotateDoor: (id) => set((state) => {
        if (!state.activeLayout || !state.activeLayout.doors) return state;
        const newDoors = state.activeLayout.doors.map(d =>
            d.id === id ? { ...d, rotation: ((d.rotation + 90) % 360) as number } : d
        );
        return {
            activeLayout: { ...state.activeLayout, doors: newDoors },
            isDirty: true,
            hasUnsavedChanges: true,
            saveStatus: 'unsaved' as const
        };
    }),

    removeDoor: (id) => set((state) => {
        if (!state.activeLayout || !state.activeLayout.doors) return state;
        const newDoors = state.activeLayout.doors.filter(d => d.id !== id);
        return {
            activeLayout: { ...state.activeLayout, doors: newDoors },
            selectedDoorId: null,
            isDirty: true,
            hasUnsavedChanges: true,
            saveStatus: 'unsaved' as const
        };
    }),

    // ── NEW: Window Actions ───────────────────────────────────────────────────

    addWindow: (window) => set((state) => {
        if (!state.activeLayout) return state;
        const newWindow: Window = {
            ...window,
            id: generateId(),
            width: window.width || 1.2,
            rotation: window.rotation || 0,
        };
        const existingWindows = state.activeLayout.windows || [];
        return {
            activeLayout: {
                ...state.activeLayout,
                windows: [...existingWindows, newWindow]
            },
            selectedWindowId: newWindow.id,
            isDirty: true,
            hasUnsavedChanges: true,
            saveStatus: 'unsaved' as const
        };
    }),

    updateWindowPosition: (id, pos) => set((state) => {
        if (!state.activeLayout || !state.activeLayout.windows) return state;
        const newWindows = state.activeLayout.windows.map(w =>
            w.id === id ? { ...w, position: { x: ROUND(pos.x), y: ROUND(pos.y) } } : w
        );
        return {
            activeLayout: { ...state.activeLayout, windows: newWindows },
            isDirty: true,
            hasUnsavedChanges: true,
            saveStatus: 'unsaved' as const
        };
    }),

    rotateWindow: (id) => set((state) => {
        if (!state.activeLayout || !state.activeLayout.windows) return state;
        const newWindows = state.activeLayout.windows.map(w =>
            w.id === id ? { ...w, rotation: ((w.rotation + 90) % 360) as number } : w
        );
        return {
            activeLayout: { ...state.activeLayout, windows: newWindows },
            isDirty: true,
            hasUnsavedChanges: true,
            saveStatus: 'unsaved' as const
        };
    }),

    removeWindow: (id) => set((state) => {
        if (!state.activeLayout || !state.activeLayout.windows) return state;
        const newWindows = state.activeLayout.windows.filter(w => w.id !== id);
        return {
            activeLayout: { ...state.activeLayout, windows: newWindows },
            selectedWindowId: null,
            isDirty: true,
            hasUnsavedChanges: true,
            saveStatus: 'unsaved' as const
        };
    }),

    // ── NEW: Stair Rotation ───────────────────────────────────────────────────

    rotateStair: (id) => set((state) => {
        if (!state.activeLayout || !state.activeLayout.stairs) return state;
        const newStairs = state.activeLayout.stairs.map(s =>
            s.id === id ? { ...s, rotation: ((s.rotation + 90) % 360) as number } : s
        );
        return {
            activeLayout: { ...state.activeLayout, stairs: newStairs },
            isDirty: true,
            hasUnsavedChanges: true,
            saveStatus: 'unsaved' as const
        };
    }),

    // ── NEW: Save/Load Actions ────────────────────────────────────────────────

    triggerAutoSave: () => {
        const state = get();
        if (state.hasUnsavedChanges && state.saveStatus !== 'saving') {
            get().manualSave();
        }
    },

    manualSave: async () => {
        const state = get();
        if (!state.activeLayout || !state.hasUnsavedChanges) return;

        set({ saveStatus: 'saving' });

        try {
            const planData = {
                nodes: state.activeLayout.nodes,
                links: state.activeLayout.links,
                rooms: state.activeLayout.rooms,
                doors: state.activeLayout.doors,
                windows: state.activeLayout.windows,
                stairs: state.activeLayout.stairs,
                siteParams: state.siteParams,
                setbackOverrides: state.setbackOverrides,
                total_area_m2: state.activeLayout.total_area_m2,
                width_m: state.activeLayout.width_m,
                height_m: state.activeLayout.height_m,
                room_types: state.activeLayout.room_types,
                original_layout_id: state.activeLayout.id,
            };

            const id = state.currentPlanId || generateId();
            const plan_name = state.currentPlanId
                ? undefined
                : `Floor Plan ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;

            const resp = await fetch('/api/save_project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, plan_name, plan_data: planData }),
            });

            if (!resp.ok) throw new Error('Save failed');

            set({
                currentPlanId: id,
                isDirty: false,
                hasUnsavedChanges: false,
                saveStatus: 'saved',
                lastSavedAt: new Date(),
            });
        } catch (err) {
            console.error('Save failed:', err);
            set({ saveStatus: 'error' });
        }
    },

    loadPlan: async (planId: string) => {
        set({ saveStatus: 'saving' });

        try {
            const resp = await fetch(`/api/load_project?id=${encodeURIComponent(planId)}`);
            if (!resp.ok) throw new Error('Plan not found');
            const payload = await resp.json();

            const planData = payload.project?.plan_data || {};
            const nodes = planData.nodes || [];
            const links = planData.links || [];
            const rooms = planData.rooms || [];
            const doors = planData.doors || [];
            const windows = planData.windows || [];
            const stairs = planData.stairs || [];

            const activeLayout: any = { nodes, links, rooms, doors, windows, stairs };

            activeLayout.total_area_m2 = planData.total_area_m2;
            activeLayout.width_m = planData.width_m;
            activeLayout.height_m = planData.height_m;
            activeLayout.id = planData.original_layout_id || planId;

            optimizeWallGraph(activeLayout.nodes, activeLayout.links, activeLayout.rooms);

            let generatedGeoJSON = generateGeoJSON(
                activeLayout.nodes, activeLayout.links,
                activeLayout.doors, activeLayout.windows, activeLayout.stairs,
                0.2, activeLayout.rooms, undefined
            );

            const ground = generatedGeoJSON;
            const first = JSON.parse(JSON.stringify(ground));
            if (first.categories?.front_door) delete first.categories.front_door;
            const roof = { categories: { wall: ground.categories?.wall, stair: ground.categories?.stair } };

            activeLayout.floor_plan_geojson_floors = { ground, first, roof };

            set({
                activeLayout,
                currentPlanId: planId,
                lastSavedAt: new Date(),
                hasUnsavedChanges: false,
                saveStatus: 'saved',
            });
        } catch (err) {
            console.error('Load failed:', err);
            set({ saveStatus: 'error' });
        }
    },
}));

// ── Auto-save Timer ──────────────────────────────────────────────────────────

// Start auto-save interval (60 seconds)
setInterval(() => {
    useAxesStore.getState().triggerAutoSave();
}, 60000);
