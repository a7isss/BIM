/**
 * Utility functions for extracting individual doors/windows from GeoJSON
 * GeoJSON stores doors/windows as paths, we need to extract them as individual objects
 */

import type { Door, Window } from './types';

/**
 * Round to nearest 5cm (0.05m)
 */
export const roundTo5cm = (meters: number): number => {
  return Math.round(meters * 20) / 20;
};

/**
 * Format distance for display (2 decimal places = cm precision)
 */
export const formatDistance = (meters: number): string => {
  return `${meters.toFixed(2)}m`;
};

/**
 * Calculate center point of a polygon ring
 */
const calculateCenter = (ring: number[][]): { x: number; y: number } => {
  if (!ring || ring.length === 0) return { x: 0, y: 0 };
  
  let sumX = 0, sumY = 0;
  for (const [x, y] of ring) {
    sumX += x;
    sumY += y;
  }
  return { x: sumX / ring.length, y: sumY / ring.length };
};

/**
 * Determine wall side based on door/window position and building bounds
 */
const determineWallSide = (
  x: number, y: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): 'north' | 'south' | 'east' | 'west' => {
  const distToNorth = Math.abs(y - bounds.minY);
  const distToSouth = Math.abs(y - bounds.maxY);
  const distToEast = Math.abs(x - bounds.maxX);
  const distToWest = Math.abs(x - bounds.minX);
  
  const minDist = Math.min(distToNorth, distToSouth, distToEast, distToWest);
  
  if (minDist === distToNorth) return 'north';
  if (minDist === distToSouth) return 'south';
  if (minDist === distToEast) return 'east';
  if (minDist === distToWest) return 'west';
  
  return 'north'; // default
};

/**
 * Calculate rotation based on wall side
 */
const getRotationForWallSide = (wallSide: 'north' | 'south' | 'east' | 'west'): number => {
  return wallSide === 'north' || wallSide === 'south' ? 0 : 90;
};

/**
 * Extract doors from GeoJSON door category
 * Handles MultiPolygon format from legacy data
 */
export function extractDoorsFromGeoJSON(geojson: any): Door[] {
  if (!geojson?.categories?.door) return [];

  const doorCategory = geojson.categories.door;
  const doors: Door[] = [];

  // Calculate building bounds from wall category
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  if (geojson.categories.wall?.coordinates) {
    const wallCoords = geojson.categories.wall.coordinates;
    wallCoords.forEach((ring: any) => {
      if (Array.isArray(ring)) {
        ring.forEach((coord: any) => {
          if (Array.isArray(coord) && coord.length >= 2) {
            const [x, y] = coord;
            if (typeof x === 'number' && typeof y === 'number') {
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
          }
        });
      }
    });
  }
  const bounds = { minX, maxX, minY, maxY };

  // Process MultiPolygon coordinates
  const processCoordinates = (coords: any[]) => {
    if (!coords || coords.length === 0) return;

    // Check if this is a single ring (Polygon) or multiple rings (MultiPolygon)
    if (typeof coords[0][0] === 'number') {
      // Single ring - this is a door polygon
      const center = calculateCenter(coords);
      const wallSide = determineWallSide(center.x, center.y, bounds);
      
      // Estimate width from the polygon dimensions
      const xs = coords.map((p: number[]) => p[0]);
      const ys = coords.map((p: number[]) => p[1]);
      const width = Math.max(...xs) - Math.min(...xs);
      const height = Math.max(...ys) - Math.min(...ys);
      const doorWidth = Math.max(width, height) || 0.9;

      doors.push({
        id: `door-${doors.length}`,
        position: { x: center.x, y: center.y },
        rotation: getRotationForWallSide(wallSide),
        width: Math.max(0.9, doorWidth),
        wallSide,
      });
      return;
    }

    // Multiple rings - process each
    coords.forEach((ring: any) => {
      if (Array.isArray(ring) && ring.length > 0) {
        const center = calculateCenter(ring);
        const wallSide = determineWallSide(center.x, center.y, bounds);
        
        const xs = ring.map((p: number[]) => p[0]);
        const ys = ring.map((p: number[]) => p[1]);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        const doorWidth = Math.max(width, height) || 0.9;

        doors.push({
          id: `door-${doors.length}`,
          position: { x: center.x, y: center.y },
          rotation: getRotationForWallSide(wallSide),
          width: Math.max(0.9, doorWidth),
          wallSide,
        });
      }
    });
  };

  if (doorCategory.coordinates) {
    processCoordinates(doorCategory.coordinates);
  }

  return doors;
}

/**
 * Extract windows from GeoJSON window category
 * Handles MultiPolygon format from legacy data
 */
export function extractWindowsFromGeoJSON(geojson: any): Window[] {
  if (!geojson?.categories?.window) return [];

  const windowCategory = geojson.categories.window;
  const windows: Window[] = [];

  // Calculate building bounds from wall category
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  if (geojson.categories.wall?.coordinates) {
    const wallCoords = geojson.categories.wall.coordinates;
    wallCoords.forEach((ring: any) => {
      if (Array.isArray(ring)) {
        ring.forEach((coord: any) => {
          if (Array.isArray(coord) && coord.length >= 2) {
            const [x, y] = coord;
            if (typeof x === 'number' && typeof y === 'number') {
              minX = Math.min(minX, x);
              maxX = Math.max(maxX, x);
              minY = Math.min(minY, y);
              maxY = Math.max(maxY, y);
            }
          }
        });
      }
    });
  }
  const bounds = { minX, maxX, minY, maxY };

  // Process MultiPolygon coordinates
  const processCoordinates = (coords: any[]) => {
    if (!coords || coords.length === 0) return;

    // Check if this is a single ring (Polygon) or multiple rings (MultiPolygon)
    if (typeof coords[0][0] === 'number') {
      // Single ring - this is a window polygon
      const center = calculateCenter(coords);
      const wallSide = determineWallSide(center.x, center.y, bounds);
      
      // Estimate width from the polygon dimensions
      const xs = coords.map((p: number[]) => p[0]);
      const ys = coords.map((p: number[]) => p[1]);
      const width = Math.max(...xs) - Math.min(...xs);
      const height = Math.max(...ys) - Math.min(...ys);
      const windowWidth = Math.max(width, height) || 1.2;

      windows.push({
        id: `window-${windows.length}`,
        position: { x: center.x, y: center.y },
        rotation: getRotationForWallSide(wallSide),
        width: Math.max(1.2, windowWidth),
        wallSide,
      });
      return;
    }

    // Multiple rings - process each
    coords.forEach((ring: any) => {
      if (Array.isArray(ring) && ring.length > 0) {
        const center = calculateCenter(ring);
        const wallSide = determineWallSide(center.x, center.y, bounds);
        
        const xs = ring.map((p: number[]) => p[0]);
        const ys = ring.map((p: number[]) => p[1]);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        const windowWidth = Math.max(width, height) || 1.2;

        windows.push({
          id: `window-${windows.length}`,
          position: { x: center.x, y: center.y },
          rotation: getRotationForWallSide(wallSide),
          width: Math.max(1.2, windowWidth),
          wallSide,
        });
      }
    });
  };

  if (windowCategory.coordinates) {
    processCoordinates(windowCategory.coordinates);
  }

  return windows;
}

/**
 * Calculate distance from point to line segment
 * Returns distance along the wall from the start point
 */
export function calculateDistanceAlongWall(
  point: { x: number; y: number },
  wall: { x1: number; y1: number; x2: number; y2: number }
): { distance: number; totalLength: number } {
  const wallLength = Math.sqrt(
    Math.pow(wall.x2 - wall.x1, 2) + Math.pow(wall.y2 - wall.y1, 2)
  );
  
  // Project point onto wall line
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  
  if (wallLength === 0) return { distance: 0, totalLength: 0 };
  
  // Normalize and project
  const t = ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / (wallLength * wallLength);
  
  // Clamp to wall segment
  const clampedT = Math.max(0, Math.min(1, t));
  
  // Distance from start
  const distance = clampedT * wallLength;
  
  return {
    distance: roundTo5cm(distance),
    totalLength: roundTo5cm(wallLength)
  };
}
