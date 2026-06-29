import os
import re

svg_dir = r"D:\BIM toolset\Next Res UI\public\furniture_svgs"

for filename in os.listdir(svg_dir):
    if filename.endswith(".svg"):
        filepath = os.path.join(svg_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Make lines black
        new_content = content.replace('stroke: #ffffff', 'stroke: #000000')
        new_content = new_content.replace('stroke="#ffffff"', 'stroke="#000000"')
        
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Made black {filename}")
