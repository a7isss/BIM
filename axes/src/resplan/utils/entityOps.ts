import type { ResPlanData, Node, TouchUp, Annotation, Opening, ArchitectureLine } from '../types';

// ── Entity Types ─────────────────────────────────────────────────────────────

export type EntityType =
  | 'node' | 'wall' | 'room'
  | 'door' | 'window'
  | 'column' | 'beam' | 'footing'
  | 'slab' | 'touchup' | 'annotation';

export interface EntityRef {
  id: string | number;
  type: EntityType;
}

// ── Geometry Helpers ─────────────────────────────────────────────────────────

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return dist(px, py, ax, ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(px, py, ax + t * abx, ay + t * aby);
}

function pointInPolygon(px: number, py: number, pts: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

// ── Get Entity Position ──────────────────────────────────────────────────────

export function getEntityPosition(
  data: ResPlanData,
  ref: EntityRef
): { x: number; y: number } | null {
  switch (ref.type) {
    case 'node': {
      const n = data.nodes.find(n => n.id === ref.id);
      return n ? { x: n.x, y: n.y } : null;
    }
    case 'door':
    case 'window': {
      const op = data.openings.find(o => o.id === ref.id);
      return op ? { x: op.x, y: op.y } : null;
    }
    case 'column': {
      const el = data.elements.find(e => e.id === ref.id);
      if (!el) return null;
      const nid = el.node_id ?? el.n1;
      if (nid == null) return null;
      const n = data.nodes.find(n => n.id === nid);
      return n ? { x: n.x, y: n.y } : null;
    }
    case 'touchup': {
      const tu = data.touchups.find(t => t.id === ref.id);
      return tu ? { x: tu.x, y: tu.y } : null;
    }
    case 'annotation': {
      const a = data.annotations?.find(a => a.id === ref.id);
      return a ? { x: a.x, y: a.y } : null;
    }
    case 'wall': {
      const arch = data.architecture.find(a => a.id === ref.id);
      if (!arch) return null;
      const n1 = data.nodes.find(n => n.id === arch.n1);
      const n2 = data.nodes.find(n => n.id === arch.n2);
      return n1 && n2 ? { x: (n1.x + n2.x) / 2, y: (n1.y + n2.y) / 2 } : null;
    }
    case 'beam': {
      const el = data.elements.find(e => e.id === ref.id);
      if (!el || el.n1 == null || el.n2 == null) return null;
      const n1 = data.nodes.find(n => n.id === el.n1);
      const n2 = data.nodes.find(n => n.id === el.n2);
      return n1 && n2 ? { x: (n1.x + n2.x) / 2, y: (n1.y + n2.y) / 2 } : null;
    }
    case 'footing': {
      const el = data.elements.find(e => e.id === ref.id);
      if (!el || el.node_id == null) return null;
      const n = data.nodes.find(n => n.id === el.node_id);
      return n ? { x: n.x, y: n.y } : null;
    }
    case 'room': {
      const room = data.rooms.find(r => r.id === ref.id);
      if (!room?.nodes || room.nodes.length < 3) return null;
      const pts = room.nodes.map(id => data.nodes.find(n => n.id === id)).filter(Boolean);
      if (pts.length < 3) return null;
      let cx = 0, cy = 0;
      for (const p of pts) { cx += p.x; cy += p.y; }
      return { x: cx / pts.length, y: cy / pts.length };
    }
    default:
      return null;
  }
}

// ── Hit Test ─────────────────────────────────────────────────────────────────

export function hitTest(
  data: ResPlanData,
  ref: EntityRef,
  x: number,
  y: number,
  thresholdMeters = 0.3
): boolean {
  switch (ref.type) {
    case 'node': {
      const n = data.nodes.find(n => n.id === ref.id);
      return n ? dist(x, y, n.x, n.y) <= thresholdMeters : false;
    }
    case 'wall': {
      const arch = data.architecture.find(a => a.id === ref.id);
      if (!arch) return false;
      if (arch.coordinates) {
        for (let i = 0; i < arch.coordinates.length - 1; i++) {
          const [ax, ay] = arch.coordinates[i];
          const [bx, by] = arch.coordinates[i + 1];
          if (pointToSegmentDist(x, y, ax, ay, bx, by) <= thresholdMeters) return true;
        }
        return false;
      }
      const n1 = data.nodes.find(n => n.id === arch.n1);
      const n2 = data.nodes.find(n => n.id === arch.n2);
      return n1 && n2 ? pointToSegmentDist(x, y, n1.x, n1.y, n2.x, n2.y) <= thresholdMeters : false;
    }
    case 'room': {
      const room = data.rooms.find(r => r.id === ref.id);
      if (!room?.nodes || room.nodes.length < 3) return false;
      const pts = room.nodes.map(id => data.nodes.find(n => n.id === id)).filter(Boolean) as Node[];
      return pts.length >= 3 && pointInPolygon(x, y, pts);
    }
    case 'door':
    case 'window': {
      const op = data.openings.find(o => o.id === ref.id);
      return op ? dist(x, y, op.x, op.y) <= thresholdMeters : false;
    }
    case 'column': {
      const el = data.elements.find(e => e.id === ref.id);
      if (!el) return false;
      const nid = el.node_id ?? el.n1;
      if (nid == null) return false;
      const n = data.nodes.find(n => n.id === nid);
      return n ? dist(x, y, n.x, n.y) <= thresholdMeters : false;
    }
    case 'beam': {
      const el = data.elements.find(e => e.id === ref.id);
      if (!el || el.n1 == null || el.n2 == null) return false;
      const n1 = data.nodes.find(n => n.id === el.n1);
      const n2 = data.nodes.find(n => n.id === el.n2);
      return n1 && n2 ? pointToSegmentDist(x, y, n1.x, n1.y, n2.x, n2.y) <= thresholdMeters : false;
    }
    case 'touchup': {
      const tu = data.touchups.find(t => t.id === ref.id);
      return tu ? dist(x, y, tu.x, tu.y) <= thresholdMeters : false;
    }
    case 'annotation': {
      const a = data.annotations?.find(a => a.id === ref.id);
      return a ? dist(x, y, a.x, a.y) <= thresholdMeters : false;
    }
    case 'footing': {
      const el = data.elements.find(e => e.id === ref.id);
      if (!el || el.node_id == null) return false;
      const n = data.nodes.find(n => n.id === el.node_id);
      return n ? dist(x, y, n.x, n.y) <= thresholdMeters : false;
    }
    case 'slab': {
      const s = data.slabs.find(sl => sl.id === ref.id);
      if (!s || !s.nodes || s.nodes.length < 3) return false;
      const pts = s.nodes.map(id => data.nodes.find(n => n.id === id)).filter(Boolean);
      return pts.length >= 3 && pointInPolygon(x, y, pts);
    }
  }
  return false;
}

// ── Find Closest Entity at Point ─────────────────────────────────────────────

export function findClosestEntity(
  data: ResPlanData,
  x: number,
  y: number,
  thresholdMeters = 0.3
): EntityRef | null {
  const candidates: { ref: EntityRef; dist: number }[] = [];

  const tryAdd = (ref: EntityRef, ex: number, ey: number) => {
    const d = dist(x, y, ex, ey);
    if (d <= thresholdMeters) candidates.push({ ref, dist: d });
  };

  const tryLine = (ref: EntityRef, ax: number, ay: number, bx: number, by: number) => {
    const d = pointToSegmentDist(x, y, ax, ay, bx, by);
    if (d <= thresholdMeters) candidates.push({ ref, dist: d });
  };

  // Small precise elements first (priority by size)
  for (const op of data.openings) {
    tryAdd({ id: op.id, type: op.type as 'door' | 'window' }, op.x, op.y);
  }
  for (const n of data.nodes) {
    tryAdd({ id: n.id, type: 'node' }, n.x, n.y);
  }
  for (const tu of data.touchups) {
    tryAdd({ id: tu.id, type: 'touchup' }, tu.x, tu.y);
  }
  for (const a of data.annotations || []) {
    tryAdd({ id: a.id, type: 'annotation' }, a.x, a.y);
  }
  for (const arch of data.architecture) {
    if (arch.coordinates) {
      for (let i = 0; i < arch.coordinates.length - 1; i++) {
        const [ax, ay] = arch.coordinates[i];
        const [bx, by] = arch.coordinates[i + 1];
        tryLine({ id: arch.id, type: 'wall' }, ax, ay, bx, by);
      }
    } else if (arch.n1 != null && arch.n2 != null) {
      const n1 = data.nodes.find(n => n.id === arch.n1);
      const n2 = data.nodes.find(n => n.id === arch.n2);
      if (n1 && n2) tryLine({ id: arch.id, type: 'wall' }, n1.x, n1.y, n2.x, n2.y);
    }
  }
  for (const el of data.elements) {
    if (el.type === 'beam' && el.n1 != null && el.n2 != null) {
      const n1 = data.nodes.find(n => n.id === el.n1);
      const n2 = data.nodes.find(n => n.id === el.n2);
      if (n1 && n2) tryLine({ id: el.id, type: 'beam' }, n1.x, n1.y, n2.x, n2.y);
    }
  }
  for (const room of data.rooms) {
    if (room.nodes && room.nodes.length >= 3) {
      const pts = room.nodes.map(id => data.nodes.find(n => n.id === id)).filter(Boolean) as Node[];
      if (pts.length >= 3 && pointInPolygon(x, y, pts))
        candidates.push({ ref: { id: room.id, type: 'room' }, dist: 0 });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0].ref;
}

// ── Move Entity ──────────────────────────────────────────────────────────────

export function moveEntity(
  data: ResPlanData,
  ref: EntityRef,
  newX: number,
  newY: number
): Partial<ResPlanData> {
  const round = (v: number) => Number(v.toFixed(3));
  switch (ref.type) {
    case 'node':
      return { nodes: data.nodes.map(n => n.id === ref.id ? { ...n, x: round(newX), y: round(newY) } : n) };
    case 'door':
    case 'window': {
      const op = data.openings.find(o => o.id === ref.id);
      if (!op) return {};
      const ux = op.ny || 0;
      const uy = -(op.nx || 0);
      const dot = (newX - op.x) * ux + (newY - op.y) * uy;
      return { openings: data.openings.map(o => o.id === ref.id ? { ...o, x: round(o.x + dot * ux), y: round(o.y + dot * uy) } : o) };
    }
    case 'column': {
      const el = data.elements.find(e => e.id === ref.id);
      if (!el) return {};
      const nid = el.node_id ?? el.n1;
      if (nid == null) return {};
      return { nodes: data.nodes.map(n => n.id === nid ? { ...n, x: round(newX), y: round(newY) } : n) };
    }
    case 'touchup':
      return { touchups: data.touchups.map(t => t.id === ref.id ? { ...t, x: round(newX), y: round(newY) } : t) };
    case 'annotation':
      return { annotations: (data.annotations || []).map(a => a.id === ref.id ? { ...a, x: round(newX), y: round(newY) } : a) };
    case 'footing': {
      const el = data.elements.find(e => e.id === ref.id);
      if (!el || el.node_id == null) return {};
      return { nodes: data.nodes.map(n => n.id === el.node_id ? { ...n, x: round(newX), y: round(newY) } : n) };
    }
    default:
      return {};
  }
}

// ── Delete Entity ────────────────────────────────────────────────────────────

export function deleteEntity(
  data: ResPlanData,
  ref: EntityRef
): Partial<ResPlanData> {
  switch (ref.type) {
    case 'node':
      return {
        nodes: data.nodes.filter(n => n.id !== ref.id),
        architecture: data.architecture.filter(a => a.n1 !== ref.id && a.n2 !== ref.id),
        elements: data.elements.filter(e => e.n1 !== ref.id && e.n2 !== ref.id && e.node_id !== ref.id),
        rooms: data.rooms.filter(r => !r.nodes?.includes(ref.id)),
      };
    case 'wall':
      return { architecture: data.architecture.filter(a => a.id !== ref.id) };
    case 'room':
      return { rooms: data.rooms.filter(r => r.id !== ref.id) };
    case 'door':
    case 'window':
      return { openings: data.openings.filter(o => o.id !== ref.id) };
    case 'column':
    case 'beam':
    case 'footing': {
      const el = data.elements.find(e => e.id === ref.id);
      let patch: any = { elements: data.elements.filter(e => e.id !== ref.id) };
      if (el?.type === 'column' && el.node_id != null) {
        const shared = data.elements.some(e => e.id !== ref.id && e.node_id === el.node_id);
        if (!shared) patch.nodes = data.nodes.filter(n => n.id !== el.node_id);
      }
      return patch;
    }
    case 'touchup':
      return { touchups: data.touchups.filter(t => t.id !== ref.id) };
    case 'annotation':
      return { annotations: (data.annotations || []).filter(a => a.id !== ref.id) };
    case 'slab':
      return { slabs: data.slabs.filter(s => s.id !== ref.id) };
  }
  return {};
}

// ── Copy Entity ──────────────────────────────────────────────────────────────

export function copyEntity(
  data: ResPlanData,
  ref: EntityRef,
  offsetMeters = 1
): { state: Partial<ResPlanData>; newRef: EntityRef } {
  const newId = `${ref.type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const noop = { state: {} as Partial<ResPlanData>, newRef: { id: '', type: ref.type } };

  switch (ref.type) {
    case 'touchup': {
      const tu = data.touchups.find(t => t.id === ref.id);
      if (!tu) return noop;
      const copy: TouchUp = { ...tu, id: newId, x: Number((tu.x + offsetMeters).toFixed(3)) };
      return { state: { touchups: [...data.touchups, copy] }, newRef: { id: newId, type: 'touchup' } };
    }
    case 'annotation': {
      const a = (data.annotations || []).find(a => a.id === ref.id);
      if (!a) return noop;
      const copy: Annotation = { ...a, id: newId, x: Number((a.x + offsetMeters).toFixed(3)), y: Number((a.y + offsetMeters).toFixed(3)) };
      return { state: { annotations: [...(data.annotations || []), copy] }, newRef: { id: newId, type: 'annotation' } };
    }
    case 'node': {
      const n = data.nodes.find(n => n.id === ref.id);
      if (!n) return noop;
      const copy: Node = { ...n, id: newId, x: Number((n.x + offsetMeters).toFixed(3)), y: Number((n.y + offsetMeters).toFixed(3)) };
      return { state: { nodes: [...data.nodes, copy] }, newRef: { id: newId, type: 'node' } };
    }
    case 'wall': {
      const arch = data.architecture.find(a => a.id === ref.id);
      if (!arch) return noop;
      const copy: ArchitectureLine = { ...arch, id: newId };
      return { state: { architecture: [...data.architecture, copy] }, newRef: { id: newId, type: 'wall' } };
    }
    case 'door':
    case 'window': {
      const op = data.openings.find(o => o.id === ref.id);
      if (!op) return noop;
      const copy: Opening = { ...op, id: newId, x: Number((op.x + offsetMeters).toFixed(3)), y: Number((op.y + offsetMeters).toFixed(3)) };
      return { state: { openings: [...data.openings, copy] }, newRef: { id: newId, type: ref.type as 'door' | 'window' } };
    }
    case 'column':
    case 'beam':
    case 'footing': {
      const el = data.elements.find(e => e.id === ref.id);
      if (!el) return noop;
      const copy = { ...el, id: newId };
      return { state: { elements: [...data.elements, copy] }, newRef: { id: newId, type: ref.type as any } };
    }
    case 'room': {
      const room = data.rooms.find(r => r.id === ref.id);
      if (!room) return noop;
      const copy = { ...room, id: newId };
      return { state: { rooms: [...data.rooms, copy] }, newRef: { id: newId, type: 'room' } };
    }
    default:
      return noop;
  }
}
