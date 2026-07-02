import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const PROJECTS_DIR = path.resolve(__dirname, '..', 'Projects');

function projectApiPlugin() {
  return {
    name: 'project-api',
    configureServer(server: any) {
      const PROJECT = (dir: string) => path.resolve(__dirname, '../Projects', dir);

      // ── Unified save_project: saves all ResPlan data files at once ──
      server.middlewares.use('/api/save_project', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: string) => body += chunk);
        req.on('end', () => {
          try {
            const { id, plan_name, plan_data } = JSON.parse(body);
            const dir = path.join(PROJECTS_DIR, id);
            fs.mkdirSync(dir, { recursive: true });
            const timestamp = new Date().toISOString();
            // Always write project.json with metadata
            const projectPayload = {
              id, plan_name,
              plan_data: plan_data || {},
              files: {
                nodes: 'resplan_nodes.json',
                architectural_types: 'resplan_types.json',
                structural_types: 'resplan_types.json',
                settings: 'project_settings.json',
                touchups: 'resplan_touchups.json',
              },
              updated_at: timestamp,
            };
            fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(projectPayload, null, 2));
            // Write individual data files
            if (plan_data) {
              fs.writeFileSync(path.join(dir, 'resplan_nodes.json'), JSON.stringify({
                nodes: plan_data.nodes || [],
                elements: plan_data.elements || [],
                slabs: plan_data.slabs || [],
                architecture: plan_data.architecture || [],
                rooms: plan_data.rooms || [],
                openings: plan_data.openings || [],
                levels: plan_data.levels || { architectural: [], structural: [] },
                project_info: plan_data.project_info || {},
                annotations: plan_data.annotations || [],
              }, null, 2));
              fs.writeFileSync(path.join(dir, 'resplan_types.json'), JSON.stringify(plan_data.types || {}, null, 2));
              fs.writeFileSync(path.join(dir, 'resplan_touchups.json'), JSON.stringify({ touchups: plan_data.touchups || [] }, null, 2));
              fs.writeFileSync(path.join(dir, 'project_settings.json'), JSON.stringify({
                floor_height_m: plan_data.settings?.floor_height_m || 3.0,
                parapet_height_m: plan_data.settings?.parapet_height_m || 1.0,
                updated_at: timestamp,
              }, null, 2));
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, id }));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      // ── Individual save endpoints (accept ?id=, default Sample Project) ──
      server.middlewares.use('/api/save', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: string) => body += chunk);
        req.on('end', () => {
          try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const id = url.searchParams.get('id') || 'Sample Project';
            const data = JSON.parse(body);
            const { annotations, ...rest } = data;
            const targetPath = path.join(PROJECT(id), 'resplan_nodes.json');
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, JSON.stringify({ ...rest, annotations: annotations || [] }, null, 2));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      server.middlewares.use('/api/save_types', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: string) => body += chunk);
        req.on('end', () => {
          try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const id = url.searchParams.get('id') || 'Sample Project';
            const data = JSON.parse(body);
            const targetPath = path.join(PROJECT(id), 'resplan_types.json');
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      server.middlewares.use('/api/save_touchups', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: string) => body += chunk);
        req.on('end', () => {
          try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const id = url.searchParams.get('id') || 'Sample Project';
            const data = JSON.parse(body);
            const targetPath = path.join(PROJECT(id), 'resplan_touchups.json');
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });

      const getProjectDir = (req: any) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        return url.searchParams.get('id') || 'Sample Project';
      };

      server.middlewares.use('/api/load_results', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        try {
          const targetPath = path.join(PROJECT(getProjectDir(req)), 'output', 'resplan_analysis_results.json');
          if (fs.existsSync(targetPath)) {
            const data = fs.readFileSync(targetPath, 'utf8');
            try { JSON.parse(data); } catch { res.setHeader('Content-Type', 'application/json'); return res.end('{}'); }
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: 'Not found' }));
          }
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      server.middlewares.use('/api/load_structural_report', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        try {
          const targetPath = path.join(PROJECT(getProjectDir(req)), 'output', 'structural_report.json');
          if (fs.existsSync(targetPath)) {
            const data = fs.readFileSync(targetPath, 'utf8');
            try { JSON.parse(data); } catch { res.setHeader('Content-Type', 'application/json'); return res.end('{}'); }
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ success: false, error: 'Not found' }));
          }
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      const loadProject = (projectDir: string, res: any) => {
        const projectPath = path.join(PROJECT(projectDir), 'project.json');
        if (!fs.existsSync(projectPath)) { res.statusCode = 404; return res.end(JSON.stringify({ success: false, error: 'not found' })); }
        try {
          const proj = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
          const loadFile = (relPath: string) => {
            const fullPath = path.join(PROJECT(projectDir), relPath);
            if (fs.existsSync(fullPath)) {
              let content = fs.readFileSync(fullPath, 'utf8');
              if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
              try { return JSON.parse(content); } catch { return {}; }
            }
            return null;
          };
          const nodesData = loadFile(proj.files?.nodes || 'resplan_nodes.json') || {};
          const payload = {
            project: proj,
            nodes_data: nodesData,
            arch_types_data: loadFile(proj.files?.architectural_types || 'resplan_types.json'),
            struct_types_data: loadFile(proj.files?.structural_types || 'resplan_types.json'),
            settings_data: loadFile(proj.files?.settings || 'project_settings.json'),
            analysis_results_data: loadFile(proj.files?.analysis_results || 'output/resplan_analysis_results.json'),
            structural_report_data: loadFile(proj.files?.structural_report || 'output/structural_report.json'),
            touchups_data: proj.files?.touchups ? loadFile(proj.files.touchups) : { touchups: [] },
            annotations: nodesData.annotations || [],
          };
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      };

      server.middlewares.use('/api/load_project', (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        const url = new URL(req.url, `http://${req.headers.host}`);
        const id = url.searchParams.get('id') || 'Sample Project';
        loadProject(id, res);
      });

      server.middlewares.use('/api/list-plans', (_req: any, res: any) => {
        try {
          fs.mkdirSync(PROJECTS_DIR, { recursive: true });
          const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
          const plans = entries
            .filter(e => e.isDirectory())
            .map(e => {
              const metaPath = path.join(PROJECTS_DIR, e.name, 'project.json');
              if (!fs.existsSync(metaPath)) return null;
              try {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                return { id: e.name, plan_name: meta.plan_name, updated_at: meta.updated_at, total_area_m2: meta.plan_data?.total_area_m2 };
              } catch { return null; }
            })
            .filter(Boolean);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(plans));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), projectApiPlugin()],
  server: {
    port: 3000,
    host: 'localhost',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
