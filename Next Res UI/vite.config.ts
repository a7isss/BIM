import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

const saveJsonPlugin = (): Plugin => ({
  name: 'save-json-plugin',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.method === 'POST' && req.url === '/api/save') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const targetPath = path.resolve(__dirname, '../Projects/Sample Project/inputs/resplan_nodes.json');
            fs.writeFileSync(targetPath, JSON.stringify(data, null, 4));
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, message: 'Saved successfully' }));
          } catch (e) {
            console.error(e);
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      } else if (req.method === 'POST' && req.url === '/api/save_types') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const targetPath = path.resolve(__dirname, '../Projects/Sample Project/inputs/resplan_types.json');
            fs.writeFileSync(targetPath, JSON.stringify(data, null, 4));
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, message: 'Types saved successfully' }));
          } catch (e) {
            console.error(e);
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      } else if (req.method === 'POST' && req.url === '/api/save_touchups') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const targetPath = path.resolve(__dirname, '../Projects/Sample Project/inputs/resplan_touchups.json');
            fs.writeFileSync(targetPath, JSON.stringify(data, null, 4));
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, message: 'Touchups saved successfully' }));
          } catch (e) {
            console.error(e);
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      } else if (req.method === 'GET' && req.url === '/api/load_results') {
        try {
          const targetPath = path.resolve(__dirname, '../Projects/Sample Project/outputs/resplan_analysis_results.json');
          if (fs.existsSync(targetPath)) {
            const data = fs.readFileSync(targetPath, 'utf8');
            try {
              JSON.parse(data); // Validate JSON
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(data);
            } catch (e) {
              console.warn(`[WARN] Invalid JSON in ${targetPath}`);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end('{}');
            }
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: 'Not found' }));
          }
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: String(e) }));
        }
      } else if (req.method === 'GET' && req.url === '/api/load_structural_report') {
        try {
          const targetPath = path.resolve(__dirname, '../Projects/Sample Project/outputs/structural_report.json');
          if (fs.existsSync(targetPath)) {
            const data = fs.readFileSync(targetPath, 'utf8');
            try {
              JSON.parse(data); // Validate JSON
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(data);
            } catch (e) {
              console.warn(`[WARN] Invalid JSON in ${targetPath}`);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end('{}');
            }
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: 'Not found' }));
          }
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: String(e) }));
        }
      } else if (req.method === 'GET' && req.url === '/api/load_project') {
        try {
          const projectPath = path.resolve(__dirname, '../Projects/Sample Project/project.json');
          if (fs.existsSync(projectPath)) {
            const proj = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
            const loadFile = (relPath: string) => {
              const fullPath = path.resolve(__dirname, '../Projects/Sample Project', relPath);
              if (fs.existsSync(fullPath)) {
                let content = fs.readFileSync(fullPath, 'utf8');
                if (content.charCodeAt(0) === 0xFEFF) {
                  content = content.slice(1);
                }
                try {
                  return JSON.parse(content);
                } catch (e) {
                  console.warn(`[WARN] Invalid JSON in ${fullPath}`);
                  return {};
                }
              }
              return null;
            };
            
            const payload = {
              project: proj,
              nodes_data: loadFile(proj.files.nodes),
              arch_types_data: loadFile(proj.files.architectural_types),
              struct_types_data: loadFile(proj.files.structural_types),
              settings_data: loadFile(proj.files.settings),
              analysis_results_data: loadFile(proj.files.analysis_results),
              structural_report_data: loadFile(proj.files.structural_report),
              touchups_data: proj.files.touchups ? loadFile(proj.files.touchups) : { touchups: [] }
            };
            
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(payload));
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: 'project.json not found' }));
          }
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: String(e) }));
        }
      } else if (req.method === 'POST' && req.url?.startsWith('/api/save')) {
        res.statusCode = 405;
        res.end('Method Not Allowed');
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    saveJsonPlugin()
  ],
})
