// Stitch에서 받은 _src/*.html 을 정적 사이트로 변환한다.
//  - Tailwind CDN 제거 → assets/css/<페이지>.css 로 미리 빌드
//  - 외부(googleusercontent) 이미지 → assets/img/ 로 내려받아 경로 교체
//  - 메뉴·카드 링크(#) → 실제 페이지 경로로 연결
// 사용법: node tools/build.mjs   (프로젝트 루트에서)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, '_src');
const IMG = path.join(ROOT, 'assets/img');
mkdirSync(IMG, { recursive: true });

// "#앵커 + 링크 문구" → 페이지. 위에서부터 처음 맞는 규칙을 쓴다.
const NAV = [
  [/^#(top|main)\b/i, null],
  [/(PREV|NEXT|이전|다음).*(RESIDENT|작가)/i, 'artist.html'],
  [/^#(prev|next)\b|이전 작품|다음 작품/i, 'work.html'],
  [/READ|EPISODE|회차|1화부터/i, 'webtoon.html'],
  [/VIEW ARTWORK|작품 상세/i, 'work.html'],
  [/DOSSIER|artist-archive|작가 아카이브|MONOGRAPH/i, 'artist.html'],
  [/exhib|^#exh|rotation|EXHIBITION|기획전|전시/i, 'exhibition.html'],
  [/artist|작가/i, 'artists.html'],
  [/webtoon|serial|연재|웹툰/i, 'webtoon.html'],
  [/^#(works?|wall)\b|WORKS|작품/i, 'work.html'],
  [/program|rental|press|academy|residency|mentoring|counsel|대관|아카데미|레지던시|강좌/i, 'about.html#programs'],
  [/liturgy|worship|gather|예배|모임|공동체/i, 'about.html#gatherings'],
  [/visit|location|오시는/i, 'about.html#visit'],
  [/about|mission|identity|소개/i, 'about.html'],
  [/^#(hero|overview|home)\b|SIDE BY SIDE|HOME/i, 'index.html'],
];

// 모바일 공통 레이어: 데스크톱용 레일·고정 메뉴에 표식 class 를 달고, 상단 바 + 전체 메뉴를 넣는다.
const MENU = [
  ['index.html', 'Home'], ['exhibition.html', 'Exhibitions'], ['artists.html', 'Artists'],
  ['webtoon.html', 'Webtoon'], ['work.html', 'Works'], ['about.html#programs', 'Programs'], ['about.html', 'About'],
];
const DARK = ['webtoon.html']; // 어두운 배경 페이지 (모바일 바도 어둡게)
const tag = (html, re, cls) => html.replace(re, m => m.includes('class="') ? m.replace('class="', `class="${cls} `) : m.replace(/^<(\w+)/, `<$1 class="${cls}"`));
const mobileLayer = (file, html) => {
  html = tag(html, /<aside class="fixed[^"]*"[^>]*>/, 'sbs-rail');
  html = tag(html, /<main\b[^>]*>/, 'sbs-main');
  html = tag(html, /<header class="fixed[^"]*"[^>]*>/g, 'sbs-fhead');
  html = tag(html, /<nav\b[^>]*>/g, 'sbs-dnav');
  html = html.replace(/<(span|div)\b([^>]*)>(\s*\[?(INDEX OF SECTIONS|CATALOGUE INDEX)\]?\s*<\/\1>)/g,
    (m, t, attrs, rest) => tag(`<${t}${attrs}>`, /^<\w+[^>]*>/, 'sbs-dnav') + rest);
  if (DARK.includes(file)) html = html.replace(/<html\b/, '<html data-sbs-theme="dark"');
  const links = MENU.map(([href, label]) =>
    `<a href="${href}"${href === file ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  html = html.replace('</head>', '<link href="assets/css/mobile.css" rel="stylesheet"/>\n<script defer src="assets/js/menu.js"></script>\n</head>');
  return html.replace(/<body\b[^>]*>/, m => `${m}
<div class="sbs-mbar"><a href="index.html">Side by Side</a><button type="button" aria-expanded="false" aria-controls="sbs-menu">MENU</button></div>
<nav class="sbs-menu" id="sbs-menu" aria-label="Mobile">${links}<small>문화예술교회 · Art Space</small></nav>`);
};

const pages = readdirSync(SRC).filter(f => f.endsWith('.html'));
const configs = {};

const download = async (url) => {
  const name = createHash('sha1').update(url).digest('hex').slice(0, 16);
  const done = readdirSync(IMG).find(f => f.startsWith(name + '.'));
  if (done) return `assets/img/${done}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const type = res.headers.get('content-type') || '';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('gif') ? 'gif' : 'jpg';
  writeFileSync(path.join(IMG, `${name}.${ext}`), Buffer.from(await res.arrayBuffer()));
  return `assets/img/${name}.${ext}`;
};

const linkFor = (anchor, inner) => {
  const text = `${anchor} ${inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`;
  for (const [re, href] of NAV) if (re.test(text)) return href;
  return null;
};

for (const file of pages) {
  let html = readFileSync(path.join(SRC, file), 'utf8');

  // Tailwind 설정 수집 후 CDN 스크립트 제거
  const CFG = /<script(?: id="tailwind-config")?>(\s*tailwind\.config\s*=[\s\S]*?)<\/script>/;
  const cfg = html.match(CFG);
  if (cfg) configs[file] = cfg[1];
  html = html
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com[^"]*"><\/script>\s*/g, '')
    .replace(new RegExp(CFG.source + '\\s*'), `<link href="assets/css/${file.replace(/\.html$/, '')}.css" rel="stylesheet"/>\n`);

  // 쓰지 않는 아이콘 폰트 제거
  if (!/material-symbols/.test(html.replace(/<link[^>]*Material\+Symbols[^>]*>/g, ''))) {
    html = html.replace(/<link[^>]*Material\+Symbols[^>]*>\s*/g, '');
  }

  // 외부 이미지 내려받기
  const urls = [...new Set(html.match(/https:\/\/lh3\.googleusercontent\.com\/[^"')\s]+/g) || [])];
  for (const u of urls) html = html.split(u).join(await download(u.replace(/&amp;/g, '&')));

  // 페이지 안 앵커(#...) 링크를 실제 페이지로 연결
  html = html.replace(/<a\b([^>]*?)href="(#[^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (m, a, anchor, b, inner) => {
    const href = linkFor(anchor, inner);
    return href ? `<a${a}href="${href}"${b}>${inner}</a>` : m;
  });

  html = mobileLayer(file, html);

  writeFileSync(path.join(ROOT, file), html);
  console.log(`page  ${file}  (${urls.length} images)`);
}

// 페이지마다 자기 tailwind.config 로 CSS 를 따로 빌드 (페이지별 색 이름이 조금씩 달라서)
writeFileSync(path.join(ROOT, 'tools/input.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
mkdirSync(path.join(ROOT, 'tools/.tw'), { recursive: true });
for (const [file, c] of Object.entries(configs)) {
  const tailwind = {};
  new Function('tailwind', c)(tailwind);
  const name = file.replace(/\.html$/, '');
  const conf = { ...(tailwind.config || {}), content: [`./${file}`] };
  const confPath = `tools/.tw/${name}.config.cjs`;
  writeFileSync(path.join(ROOT, confPath),
    `module.exports = ${JSON.stringify(conf, null, 2)};\nmodule.exports.plugins = [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')];\n`);
  execFileSync('npx', ['tailwindcss', '-c', confPath, '-i', 'tools/input.css', '-o', `assets/css/${name}.css`, '--minify'], { cwd: ROOT, stdio: 'ignore' });
  console.log(`css   assets/css/${name}.css`);
}
