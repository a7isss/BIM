
export interface Point {
  x: number;
  y: number;
}

export interface Selection {
  points: Point[];
  dimensions: { width: number; height: number };
}

export type GenerationMode = 'modify' | 'create';

export interface Profile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  full_name?: string;
  avatar_url?: string;
}

export const LANDSCAPE_STYLES = [
  'English Landscape School',
  'French Formal School',
  'American Landscape School',
  'Modernist Landscape Design',
  'Ecological/Sustainable Landscape',
  'Minimalist/Modern',
  'Japanese Zen',
  'Mediterranean',
  'Tropical/Resort',
  'Desert/Xeriscape',
  'Cottage/English Garden',
  'Urban/Contemporary',
  'Scandinavian/Nordic',
  'Climate-Adaptive Landscapes',
  'Biophilic Design',
  'Rewilding Urban Spaces',
  'Parametric Landscape Design',
  'Cultural Heritage Landscapes',
  'Productive Landscapes',
  'Persian Landscape/Chahar Bagh',
  'Islamic Landscape'
] as const;

export type LandscapeStyle = typeof LANDSCAPE_STYLES[number];

export const AREA_UNITS = [
  'Square Meters (m²)',
  'Square Feet (ft²)',
  'Acres',
  'Hectares'
] as const;

export type AreaUnit = typeof AREA_UNITS[number];

export type ToolMode = 'freehand' | 'polygonal' | 'brush' | 'all';
