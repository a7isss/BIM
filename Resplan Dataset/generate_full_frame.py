import os
import json
import math

def merge_lines(lines_data):
    """Merge collinear overlapping wall segments into single beam lines."""
    horizontal = {}
    vertical   = {}
    other      = []
    for (x1, y1), (x2, y2) in lines_data:
        if abs(y1 - y2) < 0.01:
            y = round(y1, 2)
            horizontal.setdefault(y, []).append((min(x1, x2), max(x1, x2)))
        elif abs(x1 - x2) < 0.01:
            x = round(x1, 2)
            vertical.setdefault(x, []).append((min(y1, y2), max(y1, y2)))
        else:
            other.append(((x1, y1), (x2, y2)))

    merged = []
    for y, segs in horizontal.items():
        segs.sort()
        cs, ce = segs[0]
        for s, e in segs[1:]:
            if s <= ce + 0.01:
                ce = max(ce, e)
            else:
                merged.append(((cs, y), (ce, y)))
                cs, ce = s, e
        merged.append(((cs, y), (ce, y)))

    for x, segs in vertical.items():
        segs.sort()
        cs, ce = segs[0]
        for s, e in segs[1:]:
            if s <= ce + 0.01:
                ce = max(ce, e)
            else:
                merged.append(((x, cs), (x, ce)))
                cs, ce = s, e
        merged.append(((x, cs), (x, ce)))

    return merged + other

def main():
    dataset_path = os.path.join(os.path.dirname(__file__), 'test_plan_5_ortho.js')
    out_path = os.path.join(os.path.dirname(__file__), 'frame_layout.txt')
    
    with open(dataset_path, 'r') as f:
        content = f.read()
    
    start_idx = content.find('{')
    end_idx = content.rfind('}')
    data = json.loads(content[start_idx:end_idx+1])
    
    nodes = {n['id']: n['position'] for n in data['nodes']}
    links = data['links']
    
    # Extract column positions (in meters)
    columns = []
    for pos in nodes.values():
        columns.append((pos['x'], pos['y']))
        
    # Extract wall lines for beams (in meters)
    raw_lines = []
    for link in links:
        n1 = nodes[link['source']]
        n2 = nodes[link['target']]
        raw_lines.append(((n1['x'], n1['y']), (n2['x'], n2['y'])))
        
    # Merge lines
    merged_beams = merge_lines(raw_lines)
    
    with open(out_path, 'w') as f:
        f.write("# Generated Full Structural Frame Layout\n")
        f.write("# Format: C, x(m), y(m) | B, x1(m), y1(m), x2(m), y2(m)\n\n")
        
        f.write("# Columns\n")
        for x, y in columns:
            f.write(f"C, {x:.3f}, {y:.3f}\n")
            
        f.write("\n# Beams\n")
        for (x1, y1), (x2, y2) in merged_beams:
            f.write(f"B, {x1:.3f}, {y1:.3f}, {x2:.3f}, {y2:.3f}\n")
            
    print(f"Generated {len(columns)} columns and {len(merged_beams)} beams into {out_path}")

if __name__ == "__main__":
    main()
