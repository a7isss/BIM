export interface Node {
    id: string | number;
    x: number;
    y: number;
    z: number;
    is_support?: boolean;
}

export interface Element {
    id: string;
    type: 'column' | 'beam' | 'footing';
    n1?: string | number;
    n2?: string | number;
    node_id?: string | number;
    length_m?: number;
    level_id?: string;
    b?: number;
    h?: number;
}

export interface Slab {
    id: string;
    type: 'slab';
    span_m: number;
    z_elevation: number;
    bounding_beams?: string[];
    nodes?: (string | number)[];
}

export interface Level {
    id: string;
    name: string;
    elevation_m: number;
    height_m?: number;
}

export interface LevelsConfig {
    architectural: Level[];
    structural: Level[];
}

export interface Room {
    id: string;
    type: string;
    level_id?: string;
    type_id?: string;
    nodes: (string | number)[];
}

export interface ArchitectureLine {
    id: string;
    type: string;
    level_id?: string;
    type_id?: string;
    n1?: string | number;
    n2?: string | number;
    coordinates?: [number, number][];
}

export interface ParametricShapeElement {
    type: string;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    strokeWidth?: number;
    strokeDasharray?: string;
    radius?: number;
    cx?: number;
    cy?: number;
}

export interface Opening {
    id: string;
    type: 'door' | 'window';
    level_id?: string;
    x: number;
    y: number;
    z?: number;
    angle: number;
    width?: number;
    height?: number;
    thickness?: number;
    nx?: number;
    ny?: number;
}

export interface ProjectInfo {
    name?: string;
    designer?: string;
    client?: string;
    date?: string;
    rev?: string;
    front_elevation_angle?: number;
    plot?: {
        width_m?: number;
        depth_m?: number;
        setbacks_m: {
            front: number;
            rear: number;
            side1: number;
            side2: number;
        }
    }
}

export interface TouchUp {
    id: string;
    type_id: string;
    level_id?: string;
    x: number;
    y: number;
    rotation: number;
    scale: number;
}

export interface Settings {
    floor_height_m?: number;
    parapet_height_m?: number;
}

export interface ResPlanData {
    nodes: Node[];
    elements: Element[];
    slabs: Slab[];
    architecture: ArchitectureLine[];
    rooms: Room[];
    openings: Opening[];
    levels: LevelsConfig;
    touchups: TouchUp[];
    types: any;
    project_info?: ProjectInfo;
    settings?: Settings;
}

export interface StructuralReport {
    elements?: any[];
    [key: string]: any;
}

export interface ResPlanContextType extends ResPlanData {
    bom: any[];
    structuralReport: StructuralReport | null;
    updateState: (newState: Partial<ResPlanData>) => void;
    undo: () => void;
    redo: () => void;
    save: () => Promise<void>;
    saveTypes: () => Promise<void>;
    saveTouchups: () => Promise<void>;
    reloadResults: () => Promise<void>;
    canUndo: boolean;
    canRedo: boolean;
}

export type Scope = 'architectural' | 'structural' | 'plumbing';
export type EditTool = 'select' | 'add_door' | 'remove_door' | 'add_window' | 'remove_window' | 'add_column' | 'remove_column' | 'add_beam' | 'remove_beam' | 'rotate_column' | 'move_element' | 'add_arch_wall' | 'remove_arch' | 'add_room' | 'remove_room' | 'rotate_opening' | 'add_touchup' | 'remove_touchup' | 'split_wall' | 'move_node' | 'remove_node';
