import { Router } from 'express';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const router = Router();

// In-memory cache for marketplace data (1 hour TTL)
let skillsCache: { data: any[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Fetch skills from claudemarketplaces.com ─────────────────────────────────

async function fetchMarketplaceSkills(): Promise<any[]> {
  if (skillsCache && Date.now() - skillsCache.fetchedAt < CACHE_TTL_MS) {
    return skillsCache.data;
  }

  try {
    const res = await fetch('https://claudemarketplaces.com/skills', {
      signal: AbortSignal.timeout(15_000),
    });
    const html = await res.text();

    // Extract JSON-LD data from the page
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (jsonLdMatch) {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      const items = jsonLd.itemListElement?.map((item: any) => ({
        name: item.item?.name ?? item.name,
        description: item.item?.description ?? '',
        url: item.item?.url ?? '',
        position: item.position,
      })) ?? [];
      skillsCache = { data: items, fetchedAt: Date.now() };
      return items;
    }

    // Fallback: extract skill cards from HTML
    const skills: any[] = [];
    const cardRegex = /href="\/skills\/([^"]+)"[^>]*>[\s\S]*?<h\d[^>]*>([^<]+)<\/h\d>/g;
    let match;
    while ((match = cardRegex.exec(html)) !== null) {
      skills.push({ name: match[2].trim(), slug: match[1], url: `https://claudemarketplaces.com/skills/${match[1]}` });
    }
    skillsCache = { data: skills, fetchedAt: Date.now() };
    return skills;
  } catch (err: any) {
    console.warn('[marketplace] Failed to fetch skills:', err.message);
    return skillsCache?.data ?? [];
  }
}

// ── List marketplace skills ──────────────────────────────────────────────────

router.get('/api/marketplace/skills', async (req, res) => {
  const skills = await fetchMarketplaceSkills();
  const search = (req.query.search as string)?.toLowerCase();
  const category = req.query.category as string;

  let filtered = skills;
  if (search) {
    filtered = filtered.filter(s =>
      s.name?.toLowerCase().includes(search) ||
      s.description?.toLowerCase().includes(search)
    );
  }
  if (category) {
    filtered = filtered.filter(s =>
      s.category?.toLowerCase() === category.toLowerCase()
    );
  }

  res.json({ skills: filtered, total: skills.length, cached: !!skillsCache });
});

// ── Install a skill ──────────────────────────────────────────────────────────

router.post('/api/marketplace/install', async (req, res) => {
  const { repoUrl, skillName } = req.body;
  if (!repoUrl || !skillName) {
    return res.status(400).json({ error: 'repoUrl and skillName are required' });
  }

  try {
    const cmd = `npx skills add ${repoUrl} --skill ${skillName}`;
    const output = execSync(cmd, {
      cwd: process.cwd(),
      timeout: 60_000,
      encoding: 'utf8',
    });

    res.json({ success: true, output: output.slice(0, 500) });
  } catch (err: any) {
    res.status(500).json({ error: err.message?.slice(0, 300), success: false });
  }
});

// ── List installed skills ────────────────────────────────────────────────────

router.get('/api/marketplace/installed', (_req, res) => {
  const skillsDir = path.join(process.cwd(), '.claude', 'skills');
  const installed: any[] = [];

  if (fs.existsSync(skillsDir)) {
    for (const dir of fs.readdirSync(skillsDir)) {
      const skillPath = path.join(skillsDir, dir);
      if (!fs.statSync(skillPath).isDirectory()) continue;

      // Try to read SKILL.md for metadata
      const skillMd = path.join(skillPath, 'SKILL.md');
      let description = '';
      if (fs.existsSync(skillMd)) {
        const content = fs.readFileSync(skillMd, 'utf8');
        const descMatch = content.match(/^#\s+(.+)/m);
        description = descMatch?.[1] ?? dir;
      }

      installed.push({
        name: dir,
        path: skillPath,
        description,
        hasSkillMd: fs.existsSync(skillMd),
      });
    }
  }

  res.json(installed);
});

// ── Uninstall a skill ────────────────────────────────────────────────────────

router.delete('/api/marketplace/skills/:name', (req, res) => {
  const skillsDir = path.join(process.cwd(), '.claude', 'skills', req.params.name);
  if (!fs.existsSync(skillsDir)) {
    return res.status(404).json({ error: 'Skill not found' });
  }

  try {
    fs.rmSync(skillsDir, { recursive: true });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── MCP Server Management ────────────────────────────────────────────────────

const settingsPath = () => path.join(process.cwd(), '.claude', 'settings.json');

function readSettings(): any {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settings: any) {
  const dir = path.dirname(settingsPath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

router.get('/api/mcp/servers', (_req, res) => {
  const settings = readSettings();
  res.json(settings.mcpServers ?? {});
});

router.post('/api/mcp/servers', (req, res) => {
  const { name, command, args, env } = req.body;
  if (!name || !command) {
    return res.status(400).json({ error: 'name and command are required' });
  }

  const settings = readSettings();
  if (!settings.mcpServers) settings.mcpServers = {};
  settings.mcpServers[name] = { command, args: args ?? [], env: env ?? {} };
  writeSettings(settings);

  res.json({ success: true, servers: settings.mcpServers });
});

router.delete('/api/mcp/servers/:name', (req, res) => {
  const settings = readSettings();
  if (settings.mcpServers?.[req.params.name]) {
    delete settings.mcpServers[req.params.name];
    writeSettings(settings);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'MCP server not found' });
  }
});

export default router;
