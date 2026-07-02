import { describe, it, expect } from 'vitest';
import type { ResPlanData } from '../../types';
import {
  getEntityPosition, hitTest, findClosestEntity,
  moveEntity, deleteEntity, copyEntity,
} from '../entityOps';
import type { EntityRef } from '../entityOps';

function makeData(overrides?: Partial<ResPlanData>): ResPlanData {
  return {
    nodes: [
      { id: 'n1', x: 0, y: 0, z: 0 },
      { id: 'n2', x: 10, y: 0, z: 0 },
      { id: 'n3', x: 10, y: 10, z: 0 },
      { id: 'n4', x: 0, y: 10, z: 0 },
      { id: 'n5', x: 5, y: 5, z: 0 },
    ],
    elements: [
      { id: 'col1', type: 'column', node_id: 'n5', b: 0.3, h: 0.3 },
      { id: 'beam1', type: 'beam', n1: 'n1', n2: 'n2', b: 0.2, h: 0.6 },
      { id: 'ftg1', type: 'footing', node_id: 'n1' },
    ],
    slabs: [
      { id: 'slab1', type: 'slab', span_m: 5, z_elevation: 0, nodes: ['n1', 'n2', 'n3', 'n4'] },
    ],
    architecture: [
      { id: 'wall1', type: 'wall', n1: 'n1', n2: 'n2' },
      { id: 'wall2', type: 'wall', n1: 'n2', n2: 'n3' },
    ],
    rooms: [
      { id: 'room1', type: 'living', nodes: ['n1', 'n2', 'n3', 'n4'] },
    ],
    openings: [
      { id: 'door1', type: 'door', x: 5, y: 0, z: 0, angle: 0, width: 0.9, height: 2.1 },
      { id: 'win1', type: 'window', x: 10, y: 5, z: 1, angle: Math.PI / 2, width: 1.2, height: 1.2, nx: 1, ny: 0 },
    ],
    levels: { architectural: [], structural: [] },
    touchups: [
      { id: 'tu1', type_id: 'SOFA_1', x: 2, y: 2, rotation: 0, scale: 1 },
    ],
    annotations: [
      { id: 'anno1', kind: 'text', x: 3, y: 3, text: 'Test' },
    ],
    types: { doors: [], windows: [], walls: [], rooms: [], furniture: [] },
    project_info: { name: 'Test' },
    settings: { floor_height_m: 3.0, parapet_height_m: 1.0 },
    ...overrides,
  };
}

describe('getEntityPosition', () => {
  const data = makeData();

  it('returns node position', () => {
    expect(getEntityPosition(data, { id: 'n1', type: 'node' })).toEqual({ x: 0, y: 0 });
  });

  it('returns door position', () => {
    expect(getEntityPosition(data, { id: 'door1', type: 'door' })).toEqual({ x: 5, y: 0 });
  });

  it('returns window position', () => {
    expect(getEntityPosition(data, { id: 'win1', type: 'window' })).toEqual({ x: 10, y: 5 });
  });

  it('returns column position via node', () => {
    expect(getEntityPosition(data, { id: 'col1', type: 'column' })).toEqual({ x: 5, y: 5 });
  });

  it('returns touchup position', () => {
    expect(getEntityPosition(data, { id: 'tu1', type: 'touchup' })).toEqual({ x: 2, y: 2 });
  });

  it('returns annotation position', () => {
    expect(getEntityPosition(data, { id: 'anno1', type: 'annotation' })).toEqual({ x: 3, y: 3 });
  });

  it('returns wall midpoint', () => {
    expect(getEntityPosition(data, { id: 'wall1', type: 'wall' })).toEqual({ x: 5, y: 0 });
  });

  it('returns beam midpoint', () => {
    expect(getEntityPosition(data, { id: 'beam1', type: 'beam' })).toEqual({ x: 5, y: 0 });
  });

  it('returns footing position via node', () => {
    expect(getEntityPosition(data, { id: 'ftg1', type: 'footing' })).toEqual({ x: 0, y: 0 });
  });

  it('returns room centroid', () => {
    const pos = getEntityPosition(data, { id: 'room1', type: 'room' });
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeCloseTo(5);
    expect(pos!.y).toBeCloseTo(5);
  });

  it('returns null for unknown entity', () => {
    expect(getEntityPosition(data, { id: 'nonexistent', type: 'node' })).toBeNull();
  });

  it('returns null for room with <3 nodes', () => {
    const d2 = makeData({ rooms: [{ id: 'r2', type: 'living', nodes: ['n1', 'n2'] }] });
    expect(getEntityPosition(d2, { id: 'r2', type: 'room' })).toBeNull();
  });

  it('returns null for column with no node_id', () => {
    const d2 = makeData({ elements: [{ id: 'col2', type: 'column' } as any] });
    expect(getEntityPosition(d2, { id: 'col2', type: 'column' })).toBeNull();
  });
});

describe('hitTest', () => {
  const data = makeData();

  it('hits a node at its exact position', () => {
    expect(hitTest(data, { id: 'n1', type: 'node' }, 0, 0)).toBe(true);
  });

  it('misses a node far away', () => {
    expect(hitTest(data, { id: 'n1', type: 'node' }, 100, 100)).toBe(false);
  });

  it('hits a wall segment', () => {
    expect(hitTest(data, { id: 'wall1', type: 'wall' }, 5, 0)).toBe(true);
  });

  it('hits a room interior', () => {
    expect(hitTest(data, { id: 'room1', type: 'room' }, 5, 5)).toBe(true);
  });

  it('misses outside room', () => {
    expect(hitTest(data, { id: 'room1', type: 'room' }, 20, 20)).toBe(false);
  });

  it('hits a door', () => {
    expect(hitTest(data, { id: 'door1', type: 'door' }, 5, 0)).toBe(true);
  });

  it('hits a window', () => {
    expect(hitTest(data, { id: 'win1', type: 'window' }, 10, 5)).toBe(true);
  });

  it('hits a column', () => {
    expect(hitTest(data, { id: 'col1', type: 'column' }, 5, 5)).toBe(true);
  });

  it('hits a beam segment', () => {
    expect(hitTest(data, { id: 'beam1', type: 'beam' }, 5, 0)).toBe(true);
  });

  it('hits a touchup', () => {
    expect(hitTest(data, { id: 'tu1', type: 'touchup' }, 2, 2)).toBe(true);
  });

  it('hits an annotation', () => {
    expect(hitTest(data, { id: 'anno1', type: 'annotation' }, 3, 3)).toBe(true);
  });

  it('hits a footing', () => {
    expect(hitTest(data, { id: 'ftg1', type: 'footing' }, 0, 0)).toBe(true);
  });

  it('hits a slab interior', () => {
    expect(hitTest(data, { id: 'slab1', type: 'slab' }, 5, 5)).toBe(true);
  });

  it('misses outside slab', () => {
    expect(hitTest(data, { id: 'slab1', type: 'slab' }, -10, -10)).toBe(false);
  });

  it('respects custom threshold', () => {
    expect(hitTest(data, { id: 'n1', type: 'node' }, 0.2, 0.2, 0.1)).toBe(false);
  });

  it('handles wall with coordinates array', () => {
    const d2 = makeData({ architecture: [{ id: 'wall_poly', type: 'wall', coordinates: [[0, 0], [10, 0], [10, 10]] }] });
    expect(hitTest(d2, { id: 'wall_poly', type: 'wall' }, 5, 0)).toBe(true);
    expect(hitTest(d2, { id: 'wall_poly', type: 'wall' }, 10, 5)).toBe(true);
  });

  it('returns false for missing entity', () => {
    expect(hitTest(data, { id: 'ghost', type: 'node' }, 0, 0)).toBe(false);
  });
});

describe('findClosestEntity', () => {
  it('returns nearest entity at point', () => {
    const data = makeData();
    const result = findClosestEntity(data, 0, 0, 1);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('n1');
  });

  it('returns null when nothing is close', () => {
    expect(findClosestEntity(makeData(), 100, 100, 1)).toBeNull();
  });

  it('prioritizes nearer entities over rooms', () => {
    // Remove rooms so we're not inside a polygon; n5 at (5,5) is closest to (5.1, 5.1)
    const data = makeData({ rooms: [] });
    const result = findClosestEntity(data, 5.1, 5.1, 1);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('n5');
  });
});

describe('moveEntity', () => {
  it('moves a node', () => {
    const data = makeData();
    const result = moveEntity(data, { id: 'n1', type: 'node' }, 5, 5);
    expect(result.nodes).toBeDefined();
    expect(result.nodes!.find(n => n.id === 'n1')).toMatchObject({ x: 5, y: 5 });
  });

  it('moves a door along its normal', () => {
    const data = makeData();
    const result = moveEntity(data, { id: 'door1', type: 'door' }, 5, 1);
    expect(result.openings).toBeDefined();
  });

  it('moves a column by updating its node', () => {
    const data = makeData();
    const result = moveEntity(data, { id: 'col1', type: 'column' }, 10, 10);
    expect(result.nodes).toBeDefined();
    expect(result.nodes!.find(n => n.id === 'n5')).toMatchObject({ x: 10, y: 10 });
  });

  it('moves a touchup', () => {
    const data = makeData();
    const result = moveEntity(data, { id: 'tu1', type: 'touchup' }, 8, 8);
    expect(result.touchups!.find(t => t.id === 'tu1')).toMatchObject({ x: 8, y: 8 });
  });

  it('moves an annotation', () => {
    const data = makeData();
    const result = moveEntity(data, { id: 'anno1', type: 'annotation' }, 9, 9);
    expect(result.annotations!.find(a => a.id === 'anno1')).toMatchObject({ x: 9, y: 9 });
  });

  it('moves a footing by updating its node', () => {
    const data = makeData();
    const result = moveEntity(data, { id: 'ftg1', type: 'footing' }, 3, 4);
    expect(result.nodes).toBeDefined();
    expect(result.nodes!.find(n => n.id === 'n1')).toMatchObject({ x: 3, y: 4 });
  });

  it('returns {} for unsupported types (wall, beam, room, slab)', () => {
    const data = makeData();
    expect(moveEntity(data, { id: 'wall1', type: 'wall' }, 5, 5)).toEqual({});
    expect(moveEntity(data, { id: 'beam1', type: 'beam' }, 5, 5)).toEqual({});
    expect(moveEntity(data, { id: 'room1', type: 'room' }, 5, 5)).toEqual({});
    expect(moveEntity(data, { id: 'slab1', type: 'slab' }, 5, 5)).toEqual({});
  });

  it('returns {} when column has no node_id', () => {
    const data = makeData({ elements: [{ id: 'col_orphan', type: 'column' } as any] });
    expect(moveEntity(data, { id: 'col_orphan', type: 'column' }, 5, 5)).toEqual({});
  });

  it('rounds coordinates to 3 decimals', () => {
    const data = makeData();
    const result = moveEntity(data, { id: 'n1', type: 'node' }, 1.123456, 2.654321);
    expect(result.nodes!.find(n => n.id === 'n1')).toMatchObject({ x: 1.123, y: 2.654 });
  });
});

describe('deleteEntity', () => {
  it('deletes a node and removes it from architecture/rooms/elements', () => {
    const data = makeData();
    const result = deleteEntity(data, { id: 'n1', type: 'node' });
    expect(result.nodes!.find(n => n.id === 'n1')).toBeUndefined();
    expect(result.architecture!.find(a => a.n1 === 'n1')).toBeUndefined();
    expect(result.rooms!.find(r => r.nodes?.includes('n1'))).toBeUndefined();
    expect(result.elements!.find(e => e.n1 === 'n1')).toBeUndefined();
  });

  it('deletes a wall', () => {
    const data = makeData();
    const result = deleteEntity(data, { id: 'wall1', type: 'wall' });
    expect(result.architecture!.find(a => a.id === 'wall1')).toBeUndefined();
  });

  it('deletes a room', () => {
    const data = makeData();
    const result = deleteEntity(data, { id: 'room1', type: 'room' });
    expect(result.rooms!.find(r => r.id === 'room1')).toBeUndefined();
  });

  it('deletes a door', () => {
    const data = makeData();
    const result = deleteEntity(data, { id: 'door1', type: 'door' });
    expect(result.openings!.find(o => o.id === 'door1')).toBeUndefined();
  });

  it('deletes a window', () => {
    const data = makeData();
    const result = deleteEntity(data, { id: 'win1', type: 'window' });
    expect(result.openings!.find(o => o.id === 'win1')).toBeUndefined();
  });

  it('deletes a beam', () => {
    const data = makeData();
    const result = deleteEntity(data, { id: 'beam1', type: 'beam' });
    expect(result.elements!.find(e => e.id === 'beam1')).toBeUndefined();
  });

  it('deletes a column and orphaned node if not shared', () => {
    const data = makeData();
    const result = deleteEntity(data, { id: 'col1', type: 'column' });
    expect(result.elements!.find(e => e.id === 'col1')).toBeUndefined();
    expect(result.nodes!.find(n => n.id === 'n5')).toBeUndefined();
  });

  it('deletes a column but preserves node if shared', () => {
    const d2 = makeData({ elements: [
      { id: 'col1', type: 'column', node_id: 'n5', b: 0.3, h: 0.3 },
      { id: 'col2', type: 'column', node_id: 'n5', b: 0.3, h: 0.3 },
    ] });
    const result = deleteEntity(d2, { id: 'col1', type: 'column' });
    expect(result.elements!.find(e => e.id === 'col1')).toBeUndefined();
    expect(result.nodes).toBeUndefined();
  });

  it('deletes a footing', () => {
    const data = makeData();
    const result = deleteEntity(data, { id: 'ftg1', type: 'footing' });
    expect(result.elements!.find(e => e.id === 'ftg1')).toBeUndefined();
  });

  it('deletes a touchup', () => {
    const data = makeData();
    const result = deleteEntity(data, { id: 'tu1', type: 'touchup' });
    expect(result.touchups!.find(t => t.id === 'tu1')).toBeUndefined();
  });

  it('deletes an annotation', () => {
    const data = makeData();
    const result = deleteEntity(data, { id: 'anno1', type: 'annotation' });
    expect(result.annotations!.find(a => a.id === 'anno1')).toBeUndefined();
  });

  it('deletes a slab', () => {
    const data = makeData();
    const result = deleteEntity(data, { id: 'slab1', type: 'slab' });
    expect(result.slabs!.find(s => s.id === 'slab1')).toBeUndefined();
  });
});

describe('copyEntity', () => {
  const data = makeData();

  it('copies a node with offset', () => {
    const { state, newRef } = copyEntity(data, { id: 'n1', type: 'node' }, 2);
    expect(state.nodes!.length).toBe(data.nodes.length + 1);
    expect(newRef.type).toBe('node');
    const copy = state.nodes!.find(n => n.id === newRef.id);
    expect(copy).toBeDefined();
    expect(copy!.x).toBeCloseTo(2);
  });

  it('copies a wall', () => {
    const { state, newRef } = copyEntity(data, { id: 'wall1', type: 'wall' }, 0);
    expect(state.architecture!.length).toBe(data.architecture.length + 1);
    expect(newRef.type).toBe('wall');
    expect(state.architecture!.find(a => a.id === newRef.id)).toBeDefined();
  });

  it('copies a door with offset', () => {
    const { state, newRef } = copyEntity(data, { id: 'door1', type: 'door' }, 3);
    expect(state.openings!.length).toBe(data.openings.length + 1);
    const copy = state.openings!.find(o => o.id === newRef.id);
    expect(copy).toBeDefined();
    expect(copy!.x).toBeCloseTo(8);
  });

  it('copies a window', () => {
    const { state, newRef } = copyEntity(data, { id: 'win1', type: 'window' }, 1);
    expect(state.openings!.length).toBe(data.openings.length + 1);
    expect(newRef.type).toBe('window');
  });

  it('copies a column', () => {
    const { state, newRef } = copyEntity(data, { id: 'col1', type: 'column' }, 0);
    expect(state.elements!.length).toBe(data.elements.length + 1);
    expect(newRef.type).toBe('column');
  });

  it('copies a beam', () => {
    const { state, newRef } = copyEntity(data, { id: 'beam1', type: 'beam' }, 0);
    expect(state.elements!.length).toBe(data.elements.length + 1);
    expect(newRef.type).toBe('beam');
  });

  it('copies a footing', () => {
    const { state, newRef } = copyEntity(data, { id: 'ftg1', type: 'footing' }, 0);
    expect(state.elements!.length).toBe(data.elements.length + 1);
    expect(newRef.type).toBe('footing');
  });

  it('copies a room', () => {
    const { state, newRef } = copyEntity(data, { id: 'room1', type: 'room' }, 0);
    expect(state.rooms!.length).toBe(data.rooms.length + 1);
    expect(newRef.type).toBe('room');
  });

  it('copies a touchup with offset', () => {
    const { state, newRef } = copyEntity(data, { id: 'tu1', type: 'touchup' }, 2);
    expect(state.touchups!.length).toBe(data.touchups.length + 1);
    const copy = state.touchups!.find(t => t.id === newRef.id);
    expect(copy!.x).toBeCloseTo(4);
  });

  it('copies an annotation with offset', () => {
    const { state, newRef } = copyEntity(data, { id: 'anno1', type: 'annotation' }, 2);
    expect(state.annotations!.length).toBe(data.annotations.length + 1);
    const copy = state.annotations!.find(a => a.id === newRef.id);
    expect(copy!.x).toBeCloseTo(5);
    expect(copy!.y).toBeCloseTo(5);
  });

  it('returns noop for missing entity', () => {
    const { state, newRef } = copyEntity(data, { id: 'ghost', type: 'node' }, 1);
    expect(state.nodes).toBeUndefined();
    expect(newRef.id).toBe('');
  });

  it('defaults offset to 1m', () => {
    const { state } = copyEntity(data, { id: 'n1', type: 'node' });
    const copy = state.nodes!.find(n => n.id !== 'n1' && n.id !== 'n2' && n.id !== 'n3' && n.id !== 'n4' && n.id !== 'n5');
    expect(copy).toBeDefined();
    expect(copy!.x).toBeCloseTo(1);
  });
});
