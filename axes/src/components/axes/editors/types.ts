export interface Door {
  id: string;
  position: { x: number; y: number };
  rotation: number;
  width: number;
  wallSide: 'north' | 'south' | 'east' | 'west';
  linkedRooms?: [string, string];
}

export interface Window {
  id: string;
  position: { x: number; y: number };
  rotation: number;
  width: number;
  wallSide: 'north' | 'south' | 'east' | 'west';
  room?: string;
}

export interface Stair {
  id: string;
  position: { x: number; y: number };
  rotation: number;
  width: number;
  length: number;
}
