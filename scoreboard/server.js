'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// ── Configuration ────────────────────────────────────────────────────────────

const PORT = 3000;
const POLL_INTERVAL_MS = 10_000;
const REPO = 'arve0/ki';
const EXCLUDED_USERS = ['arve0'];
const MAX_MODULE = process.env.MAX_MODULE ? Number(process.env.MAX_MODULE) : 7;

const repoRoot = path.resolve(__dirname, '..');
const worktreesDir = path.join(__dirname, 'worktrees');

// ── State ────────────────────────────────────────────────────────────────────

/** @type {{ participants: Record<string, { login: string, avatarUrl: string, repoName: string, completedModules: number[], lastChecked: string }> }} */
const state = { participants: {} };

/** Runtime-excluded logins (in addition to EXCLUDED_USERS). Persists in memory only. */
const dynamicExcluded = new Set();

function isExcluded(login) {
  return EXCLUDED_USERS.includes(login) || dynamicExcluded.has(login);
}

// ── SSE clients ──────────────────────────────────────────────────────────────

const sseClients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(msg);
  }
}

// ── Git helpers ──────────────────────────────────────────────────────────────

function git(args, opts = {}) {
  return execSync(`git ${args}`, { cwd: repoRoot, encoding: 'utf8', ...opts }).trim();
}

function gitInWorktree(login, args) {
  const wtDir = path.join(worktreesDir, login);
  return execSync(`git ${args}`, { cwd: wtDir, encoding: 'utf8' }).trim();
}

function hasRemote(login) {
  try {
    git(`remote get-url ${login}`);
    return true;
  } catch {
    return false;
  }
}

function setRemoteUrl(login, repoName) {
  const url = `https://github.com/${login}/${repoName}.git`;
  if (hasRemote(login)) {
    git(`remote set-url ${login} ${url}`);
  } else {
    git(`remote add ${login} ${url}`);
  }
}

function initWorktree(login, repoName = 'ki') {
  const wtDir = path.join(worktreesDir, login);
  setRemoteUrl(login, repoName);
  if (!fs.existsSync(wtDir)) {
    git(`fetch ${login} --depth=50`);
    git(`worktree add scoreboard/worktrees/${login} ${login}/main`);
    console.log(`[init] worktree created for ${login}`);
  } else {
    syncWorktree(login, repoName);
  }
}

function syncWorktree(login, repoName) {
  if (repoName) setRemoteUrl(login, repoName);
  git(`fetch ${login} --depth=50`);
  gitInWorktree(login, `reset --hard ${login}/main`);
}

// ── Module detection ─────────────────────────────────────────────────────────

function wtPath(login, relPath) {
  return path.join(worktreesDir, login, relPath);
}

function fileExists(login, relPath) {
  return fs.existsSync(wtPath(login, relPath));
}

function fileContains(login, relPath, keyword) {
  const p = wtPath(login, relPath);
  if (!fs.existsSync(p)) return false;
  return fs.readFileSync(p, 'utf8').toLowerCase().includes(keyword.toLowerCase());
}

function commitMessageContains(login, filePath, keywords) {
  try {
    const log = git(
      `log --oneline -20 ${login}/main ^origin/main -- ${filePath}`,
      { cwd: repoRoot }
    ).toLowerCase();
    return keywords.some(k => log.includes(k.toLowerCase()));
  } catch {
    return false;
  }
}

/**
 * Returns array of completed module numbers for the given participant.
 * Only modules with detectors implemented here are checked.
 */
function detectCompletedModules(login) {
  const completed = [];

  // Module 01 – sammendrag.md exists OR commit message contains "virker"
  if (MAX_MODULE >= 1 && (
    fileExists(login, 'sammendrag.md') ||
    commitMessageContains(login, '.', ['virker'])
  )) {
    completed.push(1);
  }

  // Module 02 – tidtaker.md exists OR commit message
  if (MAX_MODULE >= 2 && (
    fileExists(login, 'tidtaker.md') ||
    commitMessageContains(login, 'tidtaker.md', ['utforske', 'kodebase', 'teknologi'])
  )) {
    completed.push(2);
  }

  // Module 03 – tidtaker/templating.md exists OR commit message
  if (MAX_MODULE >= 3 && (
    fileExists(login, 'tidtaker/templating.md') ||
    commitMessageContains(login, 'tidtaker/templating.md', ['kontekst', 'templating'])
  )) {
    completed.push(3);
  }

  // Module 04 – AGENTS.md exists OR commit message on tidtaker/ about date format
  if (MAX_MODULE >= 4 && (
    fileExists(login, 'AGENTS.md') ||
    commitMessageContains(login, 'tidtaker/', ['dato', 'format', 'norsk', 'april', 'juni'])
  )) {
    completed.push(4);
  }

  // Module 05 – commit message on tidtaker/ about timer bug
  if (MAX_MODULE >= 5 && commitMessageContains(login, 'tidtaker/', [
    'teller', 'timer', 'feil', 'fiks', 'live', 'htmx', 'oppdater', 'bug', 'tick', 'count',
  ])) {
    completed.push(5);
  }

  // Module 06 – .agents/skills/grill-me/SKILL.md OR commit message OR eksport.md
  if (MAX_MODULE >= 6 && (
    fileExists(login, '.agents/skills/grill-me/SKILL.md') ||
    commitMessageContains(login, '.', ['grill', 'skill']) ||
    fileExists(login, 'eksport.md') ||
    fileExists(login, 'tidtaker/eksport.md')
  )) {
    completed.push(6);
  }

  // Module 07 – tidtaker/eksport.md contains "playwright" OR commit message
  if (MAX_MODULE >= 7 && (
    fileContains(login, 'tidtaker/eksport.md', 'playwright') ||
    (commitMessageContains(login, 'tidtaker/eksport.md', ['eksport']) &&
      commitMessageContains(login, 'tidtaker/eksport.md', ['import', 'detaljer']))
  )) {
    completed.push(7);
  }

  return completed;
}

// ── GitHub auth ───────────────────────────────────────────────────────────────

let _githubToken = null;

function getGitHubToken() {
  if (_githubToken) return _githubToken;
  // Try GH_TOKEN / GITHUB_TOKEN env var first
  if (process.env.GH_TOKEN) return (_githubToken = process.env.GH_TOKEN);
  if (process.env.GITHUB_TOKEN) return (_githubToken = process.env.GITHUB_TOKEN);
  // Try gh CLI
  try {
    const t = execSync('gh auth token', { encoding: 'utf8' }).trim();
    if (t) return (_githubToken = t);
  } catch {}
  // Fall back to git credential helper
  try {
    const out = execSync(
      'printf "host=github.com\\nprotocol=https\\n\\n" | git credential fill',
      { encoding: 'utf8', shell: '/bin/sh' }
    );
    const m = out.match(/password=(.+)/);
    if (m) return (_githubToken = m[1].trim());
  } catch {}
  throw new Error('No GitHub auth found. Set GH_TOKEN env var or run: gh auth login');
}

// ── Fork discovery ───────────────────────────────────────────────────────────

function fetchForks() {
  const token = getGitHubToken();
  const raw = execSync(
    `curl -s -H "Authorization: Bearer ${token}" -H "Accept: application/vnd.github+json" "https://api.github.com/repos/${REPO}/forks?per_page=100"`,
    { encoding: 'utf8' }
  );
  const forks = JSON.parse(raw);
  if (!Array.isArray(forks)) {
    throw new Error(`GitHub API error: ${JSON.stringify(forks)}`);
  }
  return forks
    .map(f => ({ login: f.owner.login, avatar_url: f.owner.avatar_url, repo_name: f.name }))
    .filter(f => !EXCLUDED_USERS.includes(f.login));
}

// ── Main loop ────────────────────────────────────────────────────────────────

async function mainLoop() {
  while (true) {
    try {
      const forks = fetchForks();
      console.log(`[loop] ${forks.length} fork(s) found`);

      for (const fork of forks) {
        const { login, avatar_url } = fork;
        try {
          if (isExcluded(login)) continue;
          if (!state.participants[login]) {
            state.participants[login] = {
              login,
              avatarUrl: avatar_url,
              repoName: fork.repo_name,
              completedModules: [],
              lastChecked: new Date().toISOString(),
            };
            initWorktree(login, fork.repo_name);
            console.log(`[fork] new participant: ${login}`);
            broadcast('fork', { login, avatarUrl: avatar_url });
          } else {
            syncWorktree(login, state.participants[login].repoName);
          }
        } catch (err) {
          console.warn(`[warn] ${login}: ${err.message}`);
        }
      }

      for (const login of Object.keys(state.participants)) {
        try {
          const prev = [...state.participants[login].completedModules];
          const now = detectCompletedModules(login);
          state.participants[login].completedModules = now;
          state.participants[login].lastChecked = new Date().toISOString();

          const newModules = now.filter(m => !prev.includes(m));
          for (const mod of newModules) {
            console.log(`[progress] ${login} completed module ${mod}`);
            broadcast('progress', { login, module: mod });
          }
        } catch (err) {
          console.warn(`[warn] detect ${login}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`[error] loop: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const publicDir = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // SSE endpoint
  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(':\n\n'); // keep-alive comment
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // State endpoint
  if (url.pathname === '/state') {
    const body = JSON.stringify({ ...state, excluded: [...dynamicExcluded] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
    return;
  }

  // Exclude endpoint: POST /exclude  { login }
  if (url.pathname === '/exclude' && req.method === 'POST') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const { login } = JSON.parse(body);
        if (!login || typeof login !== 'string') throw new Error('missing login');
        dynamicExcluded.add(login);
        delete state.participants[login];
        broadcast('excluded', { login });
        console.log(`[exclude] ${login}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400);
        res.end(err.message);
      }
    });
    return;
  }

  // Un-exclude endpoint: DELETE /exclude/{login}
  if (url.pathname.startsWith('/exclude/') && req.method === 'DELETE') {
    const login = decodeURIComponent(url.pathname.slice('/exclude/'.length));
    dynamicExcluded.delete(login);
    // Re-sync the user immediately so they appear in state again
    try {
      syncWorktree(login);
      if (!state.participants[login]) {
        const forks = fetchForks();
        const fork = forks.find(f => f.login === login);
        if (fork) {
          state.participants[login] = {
            login,
            avatarUrl: fork.avatar_url,
            completedModules: [],
            lastChecked: new Date().toISOString(),
          };
          initWorktree(login, fork.repo_name);
        }
      }
      if (state.participants[login]) {
        state.participants[login].completedModules = detectCompletedModules(login);
        state.participants[login].lastChecked = new Date().toISOString();
      }
    } catch (err) {
      console.warn(`[unexclude] re-sync failed for ${login}: ${err.message}`);
    }
    broadcast('unexcluded', { login });
    console.log(`[unexclude] ${login}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Static files
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.join(publicDir, filePath);

  // Security: prevent path traversal
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Scoreboard running at http://localhost:${PORT}`);
  console.log('[init] Venter 10 sekunder før fork-polling starter…');
  setTimeout(mainLoop, 3_000);
});
