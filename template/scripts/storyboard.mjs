// Storyboard review: renders a small preview, opens a local page with one looping clip per beat
// (Keep / Maybe / Drop + a note), and exits with the review as JSON when the user presses Submit.
//
//   node scripts/storyboard.mjs              render the preview, then serve the page
//   node scripts/storyboard.mjs --no-render  serve the last preview again
//
// Run it in the background and wait for it to exit. Result: storyboard/review.json.
// To answer notes on the next round, write storyboard/answers.json: { "<beat id>": "what changed" }.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { FPS, PUBLIC, WIN, remotion } from './lib.mjs';

const DIR = join(process.cwd(), 'storyboard');
const PORT = 4310;
const PREVIEW = join(DIR, 'preview.mp4');
const REVIEW = join(DIR, 'review.json');
mkdirSync(DIR, { recursive: true });

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const edit = readJson(join(PUBLIC, 'edit.json'), null);
if (!edit) throw new Error('No public/edit.json yet: run scripts/cut.mjs first');
const scene = readJson(join(PUBLIC, 'scene.json'), {});
const answers = readJson(join(DIR, 'answers.json'), {});
const last = readJson(REVIEW, { round: 0 }).round;
const round = (Number.isInteger(last) ? last : 0) + 1;
// Only this page gets the token: another website open in the browser cannot submit fake notes to Claude
const TOKEN = randomBytes(24).toString('hex');
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MAX_BODY = 1024 * 1024;

// Same time rules as src/time.ts
const frameOf = (at, fallback) => {
  if (at === undefined) return fallback;
  if (typeof at === 'number') return at;
  const w = edit.captions.find((c) => c.i === at.word);
  return w ? Math.round((w.startMs / 1000) * FPS) + (at.offset ?? 0) : fallback;
};
const NAMES = { headline: 'Headline', keyword: 'Keyword', list: 'List', stat: 'Number', image: 'Image', tag: 'Name tag', screen: 'Screen recording', behind: 'Text behind head', card3d: '3D card', glass: 'Liquid glass', shader: 'Shader effect', hyperframe: 'HyperFrames effect' };
const textOf = (g) => g.text ?? g.title ?? g.label ?? g.src ?? g.effect ?? '';

const beats = [];
if (scene.hook) beats.push({ id: 'hook', name: 'Text hook', detail: scene.hook.text, from: 0, to: frameOf(scene.hook.until, 75) });
(scene.graphics ?? []).forEach((g, i) => {
  const from = frameOf(g.at, -1);
  if (from >= 0) beats.push({ id: `g${i}`, name: NAMES[g.kind] ?? g.kind, detail: textOf(g), from, to: frameOf(g.until, from + FPS * 2) });
});
(scene.layouts ?? []).forEach((l, i) => {
  const from = frameOf(l.at, -1);
  // a graphic starting at the same moment already shows this switch
  if (from >= 0 && !beats.some((b) => Math.abs(b.from - from) <= 3)) beats.push({ id: `l${i}`, name: `Layout: ${l.kind}`, detail: '', from, to: from + FPS * 2 });
});
if (!beats.length) {
  for (let f = 0; f < edit.durationInFrames; f += FPS * 5) beats.push({ id: `t${f}`, name: `${f / FPS}s`, detail: '', from: f, to: f + FPS * 5 });
}
beats.sort((a, b) => a.from - b.from);
const said = (b) => edit.captions.filter((c) => { const f = (c.startMs / 1000) * FPS; return f >= b.from && f < b.to; }).map((c) => c.text.trim()).join(' ');
const cards = beats.map((b) => ({
  ...b,
  said: said(b),
  start: Math.max(0, b.from - 10) / FPS, // a third of a second of lead-in, so the arrival is visible
  end: Math.min(edit.durationInFrames, b.to + 10) / FPS,
  answer: answers[b.id] ?? '',
}));

if (!process.argv.includes('--no-render')) {
  console.log('Rendering a small preview...');
  const props = JSON.stringify({ clip: 'clip.mp4', title: '', safeZone: false, captions: true, edit: null, scene: {}, screenSizes: {} });
  writeFileSync(join(DIR, 'props.json'), props);
  const r = remotion(['render', 'Reel', PREVIEW, `--props=${join(DIR, 'props.json')}`, '--scale=0.5', '--crf=26', '--log=error'], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Storyboard</title>
<style>
:root{--bg:#0e0f13;--card:#181a21;--line:#2b2e39;--text:#f1f2f5;--dim:#9aa0ae;--keep:#35c07a;--maybe:#f0b93a;--drop:#ef5b5b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.45 -apple-system,Segoe UI,Roboto,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:14px 20px;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}
h1{font-size:19px;margin:0}header span{color:var(--dim);font-size:14px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;padding:20px;max-width:1500px;margin:auto}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
video{width:100%;aspect-ratio:9/16;display:block;background:#000;object-fit:cover}
.body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:8px;flex:1}
.name{font-weight:700}.time{color:var(--dim);font-size:13px;font-weight:400;margin-left:6px}
.detail{font-size:14px}.said{color:var(--dim);font-size:13px;font-style:italic}
.answer{font-size:13px;color:var(--keep);border-left:3px solid var(--keep);padding-left:8px}
.btns{display:flex;gap:6px;margin-top:auto}.btns button{flex:1;padding:9px 0;border-radius:9px;border:1px solid var(--line);background:transparent;color:var(--text);font-weight:600;cursor:pointer;font-size:14px}
.btns button[aria-pressed=true][data-v=keep]{background:var(--keep);color:#06170e;border-color:var(--keep)}
.btns button[aria-pressed=true][data-v=maybe]{background:var(--maybe);color:#231a02;border-color:var(--maybe)}
.btns button[aria-pressed=true][data-v=drop]{background:var(--drop);color:#2a0606;border-color:var(--drop)}
textarea{width:100%;background:#101116;color:var(--text);border:1px solid var(--line);border-radius:9px;padding:8px;font:inherit;font-size:14px;resize:vertical;min-height:44px}
#submit{background:var(--text);color:#111;border:0;border-radius:10px;padding:11px 20px;font-weight:700;font-size:15px;cursor:pointer}
#done{display:none;padding:60px 20px;text-align:center;font-size:20px}
.overall{grid-column:1/-1}
</style></head><body>
<header><div><h1>Storyboard, round ${round}</h1><span>Keep it, change it (Maybe + a note), or Drop the graphic.</span></div><button id="submit">Submit review</button></header>
<main id="m"></main><div id="done">Review sent. Go back to Claude.</div>
<script>
const cards=${JSON.stringify(cards).replace(/</g, '\\u003c')};
const state={};const m=document.getElementById('m');
const fmt=s=>s.toFixed(1)+'s';
const esc=s=>{const d=document.createElement('div');d.textContent=s;return d.innerHTML};
cards.forEach(c=>{state[c.id]={verdict:'keep',note:''};
const el=document.createElement('article');el.className='card';
el.innerHTML='<video src="/preview.mp4#t='+c.start+'" muted playsinline preload="metadata"></video><div class="body"><div class="name">'+esc(c.name)+'<span class="time">'+fmt(c.from/30)+'</span></div>'+(c.detail?'<div class="detail">'+esc(c.detail)+'</div>':'')+(c.said?'<div class="said">"'+esc(c.said)+'"</div>':'')+(c.answer?'<div class="answer">'+esc(c.answer)+'</div>':'')+'<div class="btns">'+['keep','maybe','drop'].map(v=>'<button data-v="'+v+'" aria-pressed="'+(v==='keep')+'">'+v[0].toUpperCase()+v.slice(1)+'</button>').join('')+'</div><textarea placeholder="Note (optional)"></textarea></div>';
const v=el.querySelector('video');
v.addEventListener('timeupdate',()=>{if(v.currentTime>=c.end||v.currentTime<c.start-.2)v.currentTime=c.start});
new IntersectionObserver(e=>{e[0].isIntersecting?v.play().catch(()=>{}):v.pause()},{threshold:.5}).observe(v);
v.addEventListener('click',()=>{v.muted=!v.muted});
el.querySelectorAll('.btns button').forEach(b=>b.onclick=()=>{state[c.id].verdict=b.dataset.v;el.querySelectorAll('.btns button').forEach(x=>x.setAttribute('aria-pressed',x===b))});
el.querySelector('textarea').oninput=e=>{state[c.id].note=e.target.value;if(e.target.value&&state[c.id].verdict==='keep'){el.querySelector('[data-v=maybe]').click()}};
m.appendChild(el)});
const o=document.createElement('div');o.className='overall';o.innerHTML='<textarea id="overall" placeholder="Notes on the whole video (optional)"></textarea>';m.appendChild(o);
document.getElementById('submit').onclick=async()=>{const body={round:${round},overall:document.getElementById('overall').value,beats:cards.map(c=>({id:c.id,name:c.name,detail:c.detail,atSeconds:+(c.from/30).toFixed(2),...state[c.id]}))};
await fetch('/review',{method:'POST',headers:{'content-type':'application/json','x-review-token':'${TOKEN}'},body:JSON.stringify(body)});
m.style.display='none';document.querySelector('header').style.display='none';document.getElementById('done').style.display='block'};
</script></body></html>`;

const validReview = (r) => r && typeof r === 'object' && typeof r.overall === 'string' && Array.isArray(r.beats) && r.beats.length <= cards.length
  && r.beats.every((b) => b && cards.some((c) => c.id === b.id) && ['keep', 'maybe', 'drop'].includes(b.verdict) && typeof b.note === 'string');

const server = createServer((req, res) => {
  const refuse = (code) => { res.writeHead(code); res.end(); };
  if (req.headers.host !== `127.0.0.1:${PORT}`) return refuse(403); // blocks DNS rebinding from other sites
  if (req.method === 'POST' && req.url === '/review') {
    if (req.headers.origin !== ORIGIN || req.headers['x-review-token'] !== TOKEN || !String(req.headers['content-type']).startsWith('application/json')) return refuse(403);
    let body = '';
    req.on('data', (d) => {
      body += d;
      if (body.length > MAX_BODY) req.destroy();
    });
    req.on('end', () => {
      let review;
      try {
        review = JSON.parse(body);
      } catch {
        return refuse(400);
      }
      if (!validReview(review)) return refuse(400);
      review = { round, overall: review.overall, beats: review.beats };
      writeFileSync(REVIEW, JSON.stringify(review, null, 1));
      res.end('ok');
      const changes = review.beats.filter((b) => b.verdict !== 'keep');
      console.log(`REVIEW round ${review.round}: ${review.beats.length - changes.length} keep, ${changes.length} to change`);
      console.log(JSON.stringify({ overall: review.overall, changes }, null, 1));
      server.close(() => process.exit(0));
      server.closeAllConnections();
    });
    return;
  }
  if (req.url.startsWith('/preview.mp4')) {
    // Range support: browsers need it to seek inside the video
    const size = statSync(PREVIEW).size;
    const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
    if (!m) {
      res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': size, 'accept-ranges': 'bytes' });
      createReadStream(PREVIEW).pipe(res);
      return;
    }
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : size - 1;
    res.writeHead(206, { 'content-type': 'video/mp4', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1, 'accept-ranges': 'bytes' });
    createReadStream(PREVIEW, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(page);
});

server.listen(PORT, '127.0.0.1', () => {
  const url = ORIGIN;
  console.log(`STORYBOARD ${url} (${cards.length} beats). Waiting for Submit...`);
  if (!process.argv.includes('--no-open')) {
    spawn(WIN ? 'cmd' : 'open', WIN ? ['/c', 'start', '', url] : [url], { detached: true, stdio: 'ignore' }).unref();
  }
});
