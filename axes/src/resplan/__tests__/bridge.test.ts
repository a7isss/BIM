import { describe, it, expect } from 'vitest';
import { axesToResPlan } from '../bridge';

describe('axesToResPlan', () => {
  it('returns empty data when input is null', () => {
    const result = axesToResPlan(null);
    expect(result.nodes).toEqual([]);
    expect(result.architecture).toEqual([]);
    expect(result.rooms).toEqual([]);
    expect(result.openings).toEqual([]);
    expect(result.annotations).toEqual([]);
  });

  it('translates nodes with position', () => {
    const input = {
      nodes: [
        { id: '1', position: { x: 0, y: 0 } },
        { id: '2', position: { x: 10, y: 0 } },
      ],
      links: [],
      rooms: [],
      doors: [],
      windows: [],
    };
    const result = axesToResPlan(input);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toMatchObject({ x: 0, y: 0, z: 0 });
    expect(result.nodes[1]).toMatchObject({ x: 10, y: 0, z: 0 });
  });

  it('falls back to centroid when position is missing', () => {
    const input = {
      nodes: [{ id: '1', centroid: { x: 5, y: 5 } }],
      links: [],
      rooms: [],
      doors: [],
      windows: [],
    };
    const result = axesToResPlan(input);
    expect(result.nodes[0]).toMatchObject({ x: 5, y: 5 });
  });

  it('translates links of type room_wall to architecture', () => {
    const input = {
      nodes: [
        { id: 'n1', position: { x: 0, y: 0 } },
        { id: 'n2', position: { x: 10, y: 0 } },
      ],
      links: [
        { source: 'n1', target: 'n2', type: 'room_wall' },
      ],
      rooms: [],
      doors: [],
      windows: [],
    };
    const result = axesToResPlan(input);
    expect(result.architecture).toHaveLength(1);
    expect(result.architecture[0]).toMatchObject({ type: 'wall' });
  });

  it('ignores links that are not room_wall', () => {
    const input = {
      nodes: [
        { id: 'n1', position: { x: 0, y: 0 } },
        { id: 'n2', position: { x: 10, y: 0 } },
      ],
      links: [
        { source: 'n1', target: 'n2', type: 'grid_line' },
      ],
      rooms: [],
      doors: [],
      windows: [],
    };
    const result = axesToResPlan(input);
    expect(result.architecture).toHaveLength(0);
  });

  it('deduplicates wall pairs', () => {
    const input = {
      nodes: [
        { id: '1', position: { x: 0, y: 0 } },
        { id: '2', position: { x: 10, y: 0 } },
      ],
      links: [
        { source: '1', target: '2', type: 'room_wall' },
        { source: '2', target: '1', type: 'room_wall' },
      ],
      rooms: [],
      doors: [],
      windows: [],
    };
    const result = axesToResPlan(input);
    expect(result.architecture).toHaveLength(1);
  });

  it('translates rooms with wall_nodes', () => {
    const input = {
      nodes: [
        { id: '1', position: { x: 0, y: 0 } },
        { id: '2', position: { x: 10, y: 0 } },
        { id: '3', position: { x: 10, y: 10 } },
        { id: '4', position: { x: 0, y: 10 } },
      ],
      links: [],
      rooms: [
        { id: 'r1', type: 'living', type_id: 'LIVING_SPACE', wall_nodes: ['1', '2', '3', '4'] },
      ],
      doors: [],
      windows: [],
    };
    const result = axesToResPlan(input);
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0].nodes).toHaveLength(4);
    expect(result.rooms[0].type_id).toBe('LIVING_SPACE');
  });

  it('skips rooms with too few mapped nodes', () => {
    const input = {
      nodes: [{ id: '1', position: { x: 0, y: 0 } }],
      links: [],
      rooms: [{ id: 'r1', type: 'living', wall_nodes: ['1', '999'] }],
      doors: [],
      windows: [],
    };
    const result = axesToResPlan(input);
    expect(result.rooms).toHaveLength(0);
  });

  it('translates doors with wallSide', () => {
    const input = {
      nodes: [],
      links: [],
      rooms: [],
      doors: [
        { id: 'd1', position: { x: 5, y: 0 }, rotation: 0, wallSide: 'north', width: 0.9 },
      ],
      windows: [],
    };
    const result = axesToResPlan(input);
    expect(result.openings).toHaveLength(1);
    expect(result.openings[0]).toMatchObject({
      type: 'door',
      x: 5, y: 0,
      width: 0.9, height: 2.1,
      nx: 0, ny: 1,
    });
  });

  it('derives nx/ny from rotation when no wallSide', () => {
    const input = {
      nodes: [],
      links: [],
      rooms: [],
      doors: [
        { id: 'd1', position: { x: 5, y: 0 }, rotation: 90, width: 0.9 },
      ],
      windows: [],
    };
    const result = axesToResPlan(input);
    expect(result.openings).toHaveLength(1);
    expect(result.openings[0].nx).toBeCloseTo(0);
    expect(result.openings[0].ny).toBeCloseTo(1);
  });

  it('properly sets window z to 1.0 as default sill height', () => {
    const input = {
      nodes: [],
      links: [],
      rooms: [],
      doors: [],
      windows: [
        { id: 'w1', position: { x: 10, y: 5 }, width: 1.2 },
      ],
    };
    const result = axesToResPlan(input);
    expect(result.openings).toHaveLength(1);
    expect(result.openings[0]).toMatchObject({
      type: 'window', z: 1.0, height: 1.2,
    });
  });

  it('creates default levels and project_info with plot', () => {
    const input = {
      nodes: [{ id: '1', position: { x: 0, y: 0 } }],
      links: [],
      rooms: [],
      doors: [],
      windows: [],
      total_area_m2: 200,
      plan_name: 'Test Plan',
      width_m: 20,
      height_m: 30,
    };
    const result = axesToResPlan(input);
    expect(result.levels.architectural).toHaveLength(2);
    expect(result.levels.structural).toHaveLength(2);
    expect(result.project_info!.name).toBe('Test Plan');
    expect(result.project_info!.plot!.width_m).toBe(20);
  });

  it('initializes empty arrays for elements, slabs, touchups, annotations', () => {
    const result = axesToResPlan({ nodes: [], links: [], rooms: [], doors: [], windows: [] });
    expect(result.elements).toEqual([]);
    expect(result.slabs).toEqual([]);
    expect(result.touchups).toEqual([]);
    expect(result.annotations).toEqual([]);
  });
});
