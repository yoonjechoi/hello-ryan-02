#!/usr/bin/env node
// upload.mjs (v2) — 작품을 헬로 라이언 갤러리로 올리는 엔진. 자유 업로드판.
//
// v1(브랜드 키트 고정)과 달리 무엇이든 올린다:
//   - HTML/CSS/JS/MD/TXT/JSON/SVG 는 텍스트로(files), 이미지(png/jpg/webp/gif/ico)는 base64로(filesBase64).
//   - web.html 강제 없음. 공개 파일 1개 이상이면 OK.
//   - 같은 --name 재전송 = 그 작품 통째로 업데이트. 다른 --name = 새 작품(여러 개 가능).
//
// 사용:
//   node upload.mjs <폴더|파일 ...> --name "작품 이름" [--key <업로드키>] [--dry-run]
//     [--tagline "…"] [--desc "…"] [--category "…"] [--deploy <URL>] [--rep <파일명>]
//     [--private <폴더|파일>]... [--episode <회차슬러그>] [--endpoint <URL>]
//     [--archive <폴더>] [--no-archive]
//   경로 생략 → 현재 폴더에서 자동 수집.
//   --key 생략 시 저장된 키(~/.hello-ryan/upload-key) 사용. --key 주면 저장 후 재사용.
//
// 아카이브(프라이버시 계층):
//   폴더를 업로드하면 그 폴더 전체(중간 생성물 포함)를 zip으로 묶어 **비공개 아카이브**로
//   함께 올린다(기본 동작, --no-archive 로 끔, --archive <다른폴더> 로 대상 변경).
//   갤러리에 공개되는 건 공개 파일 목록뿐 — 아카이브는 주인과 운영진만 열람 가능.
//   내 아카이브 받기: node upload.mjs --get-archive <slug>
//
// 전송 우선순위: 1) Node 내장 fetch → 2) node:https 폴백 → 3) 이메일 폴백(payload 파일).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

// 기본 = 운영 배포 주소 (개발 시엔 환경변수 HELLO_RYAN_ENDPOINT 로 로컬 지정)
const DEFAULT_ENDPOINT = process.env.HELLO_RYAN_ENDPOINT || 'https://hello-ryan-v2.vercel.app/api/submit';
const FALLBACK_EMAIL = process.env.HELLO_RYAN_FALLBACK_EMAIL || '<진행자 이메일>';
const KEY_STORE = path.join(os.homedir(), '.hello-ryan', 'upload-key');

const TEXT_EXT = new Set(['html', 'htm', 'css', 'js', 'mjs', 'json', 'md', 'txt', 'svg']);
const BINARY_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'ico']);
const MAX_FILE = 20 * 1024 * 1024;     // 서버와 동일: 공개 파일당 20MB
const MAX_ARCHIVE = 20 * 1024 * 1024;  // 서버와 동일: 비공개 아카이브 zip 20MB
const MAX_TOTAL = 40 * 1024 * 1024;    // 서버와 동일: 요청 전체 40MB

// ---------- 인자 파싱 ----------
const argv = process.argv.slice(2);
const opts = { dryRun: false, endpoint: DEFAULT_ENDPOINT, privates: [] };
const paths = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--key') opts.key = argv[++i];
  else if (a === '--name') opts.name = argv[++i];
  else if (a === '--tagline') opts.tagline = argv[++i];
  else if (a === '--desc') opts.desc = argv[++i];
  else if (a === '--category') opts.category = argv[++i];
  else if (a === '--deploy') opts.deploy = argv[++i];
  else if (a === '--rep') opts.rep = argv[++i];
  else if (a === '--private') opts.privates.push(argv[++i]);
  else if (a === '--episode') opts.episode = argv[++i];
  else if (a === '--endpoint') opts.endpoint = argv[++i];
  else if (a === '--archive') opts.archive = argv[++i];
  else if (a === '--no-archive') opts.noArchive = true;
  else if (a === '--get-archive') opts.getArchive = argv[++i];
  else if (!a.startsWith('--')) paths.push(a);
}

function die(msg) { console.error('✖ ' + msg); process.exit(1); }
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
function fmtKB(n) { return n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + 'KB' : (n / 1024 / 1024).toFixed(1) + 'MB'; }

// ---------- 업로드 키: 인자 > 저장본 ----------
function resolveKey() {
  if (opts.key) {
    fs.mkdirSync(path.dirname(KEY_STORE), { recursive: true });
    fs.writeFileSync(KEY_STORE, opts.key.trim(), { mode: 0o600 });
    return opts.key.trim();
  }
  if (exists(KEY_STORE)) return fs.readFileSync(KEY_STORE, 'utf8').trim();
  die('업로드 키가 없어요. 사이트 마이페이지 → "내 업로드 키"의 한 줄을 붙여넣거나 "--key <키>" 로 한 번 넣어주세요(다음부턴 저장돼서 생략 가능).');
}

// ---------- 파일 수집 ----------
/** 서버 계약과 동일한 안전한 파일명으로 정규화(영숫자·._- 만, 128자). */
function safeName(name, used) {
  const rawExt = path.extname(name); // ".md"
  const ext = rawExt.replace(/[^A-Za-z0-9.]/g, '').toLowerCase();
  let stem = path.basename(name, rawExt).normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '') // 비ASCII(한글 등) 제거
    .replace(/[^A-Za-z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  if (!stem) stem = 'file'; // 이름이 전부 한글이던 경우 등
  const base = (stem + ext).slice(-128);
  let cand = base, n = 1;
  while (used.has(cand)) {
    cand = base.slice(0, base.length - ext.length) + '-' + (++n) + ext;
  }
  return cand;
}

function extOf(p) { return path.extname(p).slice(1).toLowerCase(); }

/** 경로(파일|폴더) 목록 → [{name, abs, ext, size, binary}] (폴더는 1단계만, 숨김/_/node_modules 제외) */
function collect(list, label) {
  const out = [];
  for (const p of list) {
    const abs = path.resolve(p);
    if (!exists(abs)) die(`${label} 경로를 못 찾았어요: ${p}`);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        if (!e.isFile()) continue;
        if (e.name.startsWith('.') || e.name.startsWith('_') || e.name === 'node_modules') continue;
        const ext = extOf(e.name);
        if (!TEXT_EXT.has(ext) && !BINARY_EXT.has(ext)) continue;
        out.push({ abs: path.join(abs, e.name), orig: e.name, ext });
      }
    } else {
      const ext = extOf(abs);
      if (!TEXT_EXT.has(ext) && !BINARY_EXT.has(ext))
        die(`지원하지 않는 파일 형식이에요: ${p} (지원: ${[...TEXT_EXT, ...BINARY_EXT].join(', ')})`);
      out.push({ abs, orig: path.basename(abs), ext });
    }
  }
  return out;
}

function toMaps(entries, used, renamed) {
  const text = {}, b64 = {};
  let total = 0;
  for (const f of entries) {
    const size = fs.statSync(f.abs).size;
    if (size > MAX_FILE) die(`파일이 너무 커요(20MB 제한): ${f.orig} (${fmtKB(size)})`);
    total += size;
    const name = safeName(f.orig, used);
    used.add(name);
    if (name !== f.orig) renamed.push(`${f.orig} → ${name}`);
    if (TEXT_EXT.has(f.ext)) text[name] = fs.readFileSync(f.abs, 'utf8');
    else b64[name] = fs.readFileSync(f.abs).toString('base64');
    f.name = name; f.size = size;
  }
  return { text, b64, total };
}

// ---------- 전체 생성물 zip 아카이브 (비공개) ----------
/** 폴더 전체를 zip으로. mac/linux=zip CLI, windows=PowerShell. 실패하면 null(아카이브만 생략). */
function makeArchiveZip(srcDir) {
  const abs = path.resolve(srcDir);
  if (!exists(abs) || !fs.statSync(abs).isDirectory()) die(`--archive 폴더를 못 찾았어요: ${srcDir}`);
  const out = path.join(os.tmpdir(), `hello-ryan-archive-${process.pid}.zip`);
  fs.rmSync(out, { force: true });
  try {
    if (process.platform === 'win32') {
      // 참고: Compress-Archive 는 제외 패턴이 없어 폴더 전체를 담는다.
      execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${abs}\\*' -DestinationPath '${out}' -Force"`, { stdio: 'pipe' });
    } else {
      execSync(`zip -r -q '${out}' . -x 'node_modules/*' -x '*/node_modules/*' -x '.git/*' -x '*/.git/*' -x '_upload-payload.json' -x '.DS_Store' -x '*/.DS_Store'`, { cwd: abs, stdio: 'pipe' });
    }
  } catch (e) {
    console.error('⚠ zip 생성에 실패해서 아카이브 없이 진행해요: ' + ((e && e.message) || e));
    return null;
  }
  if (!exists(out)) { console.error('⚠ zip 파일이 안 만들어져서 아카이브 없이 진행해요.'); return null; }
  const size = fs.statSync(out).size;
  if (size > MAX_ARCHIVE) {
    console.error(`⚠ 아카이브가 너무 커요(${fmtKB(size)} > 20MB). 아카이브 없이 진행해요. (큰 파일을 빼고 다시 시도 가능)`);
    fs.rmSync(out, { force: true });
    return null;
  }
  return { path: out, size };
}

// ---------- 내 아카이브 받기 (--get-archive <slug>) ----------
async function getArchive(slug) {
  const key = resolveKey();
  const archiveEndpoint = opts.endpoint.replace(/\/submit\/?$/, '/archive');
  console.log('● 아카이브 요청 중 … → ' + archiveEndpoint);
  let r;
  try {
    r = await postJson(archiveEndpoint, JSON.stringify({ uploadKey: key, slug }));
  } catch (e) {
    die('서버에 연결 못 했어요: ' + ((e && e.message) || e));
  }
  if (r.status === 401) die('키가 안 맞아요. 사이트에서 받은 키를 다시 확인해 주세요.');
  if (r.status === 403) die('이 작품의 주인(또는 운영진)만 아카이브를 받을 수 있어요.');
  if (r.status === 404) die('아카이브가 없어요 (작품이 없거나 비공개 파일이 0개).');
  if (r.status >= 400) die(`서버가 거절했어요 (HTTP ${r.status}): ${r.text.slice(0, 200)}`);
  const data = JSON.parse(r.text);
  const dir = path.resolve(`${slug}-archive`);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of data.files) {
    const res = await fetch(f.url);
    if (!res.ok) { console.error(`⚠ 다운로드 실패: ${f.name} (HTTP ${res.status})`); continue; }
    fs.writeFileSync(path.join(dir, f.name), Buffer.from(await res.arrayBuffer()));
    console.log('  ↓ ' + f.name);
  }
  console.log('✓ 받았어요: ' + dir);
  process.exit(0);
}

// ---------- 전송: 1)fetch 2)https 폴백 ----------
async function postJson(url, bodyStr) {
  if (typeof fetch === 'function') {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodyStr });
    return { status: res.status, text: await res.text() };
  }
  const https = await import('node:https');
  const u = new URL(url);
  return await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, port: u.port || 443, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
    }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve({ status: r.statusCode, text: d })); });
    req.on('error', reject);
    req.write(bodyStr); req.end();
  });
}

// ---------- 이메일 폴백 ----------
function emailFallback(payload, reason) {
  const out = path.resolve('_upload-payload.json');
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  console.error('✖ 자동 업로드가 안 됐어요 (' + reason + ').');
  console.error('  → 대신 이메일로 보내면 진행자가 올려드려요:');
  console.error('    1) 첨부 파일: ' + out);
  console.error('    2) 받는 사람: ' + FALLBACK_EMAIL);
  console.error('    3) 제목: [작품 제출] ' + (payload.brand.name || ''));
  process.exit(2);
}

// ---------- 실행 ----------
if (opts.getArchive) await getArchive(opts.getArchive);

const srcPaths = paths.length > 0 ? paths : ['.'];
const pubEntries = collect(srcPaths, '올릴');
if (pubEntries.length === 0)
  die('올릴 파일을 못 찾았어요. 폴더나 파일을 지정해 주세요. 예) node upload.mjs my-site/ --name "내 작품"');

// 작품 이름: --name > 단일 폴더면 폴더명 제안
let workName = (opts.name || '').trim();
if (!workName) {
  const only = paths.length === 1 && exists(paths[0]) && fs.statSync(paths[0]).isDirectory() ? path.basename(path.resolve(paths[0])) : null;
  if (only) workName = only;
  else die('작품 이름이 필요해요. --name "내 작품 이름" 으로 알려주세요. (같은 이름 = 업데이트, 다른 이름 = 새 작품)');
}

const key = resolveKey();
const used = new Set();
const renamed = [];
const pub = toMaps(pubEntries, used, renamed);
const privEntries = collect(opts.privates, '비공개');
const priv = toMaps(privEntries, used, renamed);

// 아카이브 대상: --archive 지정 > (기본) 업로드 경로의 첫 폴더. --no-archive 로 끔.
let archiveDir = opts.archive || null;
if (!archiveDir && !opts.noArchive) {
  archiveDir = srcPaths.find(p => exists(p) && fs.statSync(path.resolve(p)).isDirectory()) || null;
}
const archive = !opts.noArchive && archiveDir ? makeArchiveZip(archiveDir) : null;

const totalBytes = pub.total + priv.total + (archive ? archive.size : 0);
if (totalBytes > MAX_TOTAL) die(`전체 용량이 너무 커요(40MB 제한): ${fmtKB(totalBytes)}. 파일을 줄여 주세요.`);

// 대표 파일: --rep > index.html > web.html > 첫 html > 첫 파일 (서버도 동일 로직)
const pubNames = pubEntries.map(f => f.name);
let rep = opts.rep && pubNames.includes(opts.rep) ? opts.rep : null;
if (opts.rep && !rep) die(`--rep 파일이 올릴 목록에 없어요: ${opts.rep}`);
rep = rep || (pubNames.includes('index.html') && 'index.html') || (pubNames.includes('web.html') && 'web.html')
  || pubNames.find(n => /\.html?$/i.test(n)) || pubNames[0];

const payload = {
  uploadKey: key,
  brand: {
    name: workName,
    tagline: opts.tagline || null,
    description: opts.desc || null,
    category: opts.category || null,
    ownDeployUrl: opts.deploy || null,
  },
  files: pub.text,
  filesBase64: pub.b64,
  private: priv.text,
  privateBase64: priv.b64,
  representative: rep,
};
if (archive) payload.privateBase64['archive.zip'] = fs.readFileSync(archive.path).toString('base64');
if (opts.episode) payload.episodeSlug = opts.episode;

console.log(`● 작품 "${workName}" · 공개 ${pubEntries.length}개 · 비공개 ${privEntries.length + (archive ? 1 : 0)}개 · ${fmtKB(totalBytes)} · 대표 ${rep}`);
for (const f of pubEntries) console.log(`   공개   ${f.name}  (${fmtKB(f.size)})`);
for (const f of privEntries) console.log(`   비공개 ${f.name}  (${fmtKB(f.size)})`);
if (archive) console.log(`   비공개 archive.zip — ${path.basename(path.resolve(archiveDir))}/ 전체 생성물 (${fmtKB(archive.size)}) · 주인/운영진만 열람`);
if (renamed.length) console.log('  ⚠ 파일명을 안전하게 바꿨어요: ' + renamed.join(', '));

if (opts.dryRun) {
  const out = path.resolve('_upload-payload.json');
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log('● DRY-RUN (전송 안 함) — payload 미리보기 저장: ' + out);
  process.exit(0);
}

console.log('● 업로드 중 … → ' + opts.endpoint);
let r;
try {
  r = await postJson(opts.endpoint, JSON.stringify(payload));
} catch (e) {
  emailFallback(payload, `서버에 연결 못 함: ${(e && e.message) || e}`);
}

if (r.status === 401 || r.status === 403)
  die(`키가 안 맞아요 (HTTP ${r.status}). 사이트에서 받은 키를 다시 확인해 주세요.`);
if (r.status === 404 || r.status >= 500)
  emailFallback(payload, `서버가 아직 준비 안 됐거나 오류 (HTTP ${r.status})`);
if (r.status >= 400)
  die(`보낸 내용을 서버가 거절했어요 (HTTP ${r.status}). 응답: ${r.text.slice(0, 300)}`);

if (archive) fs.rmSync(archive.path, { force: true }); // tmp zip 정리

let data; try { data = JSON.parse(r.text); } catch { data = {}; }
const view = data.viewUrl ? new URL(data.viewUrl, opts.endpoint).href : '(viewUrl 없음)';
const gallery = data.galleryUrl ? new URL(data.galleryUrl, opts.endpoint).href : null;
console.log('✓ 올렸어요! 내 작품: ' + view);
if (gallery) console.log('  다 같이 보는 갤러리: ' + gallery);
console.log('  · 고쳐서 같은 이름으로 다시 올리면 업데이트돼요.');
console.log('  · 다른 작품은 --name 만 바꿔서 또 올릴 수 있어요.');
if (archive) console.log(`  · 전체 생성물 아카이브는 비공개예요. 받으려면: node upload.mjs --get-archive ${data.slug || '<slug>'}`);
