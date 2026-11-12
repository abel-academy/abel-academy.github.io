// 학생 전용 → 학습 보조 탭: 선생님이 등록한 게임 중 내 학년에 맞는 것
import * as be from './backend.js';
import { el, friendlyError, subjectsOf } from './common.js';
import { LEARN_BUILTINS } from './learn-games.js';
import { loadRecord, totalStars } from './learn-records.js';

const builtinOf = (g) => (g.kind === 'builtin' ? LEARN_BUILTINS.find((b) => b.id === g.builtin) : null);

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function icon(kind) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('width', '30'); svg.setAttribute('height', '30'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2.2'); p.setAttribute('stroke-linejoin', 'round'); p.setAttribute('stroke-linecap', 'round');
  // 정육면체(학원 게임) / 돋보기(명제 탐정) / 바깥 화살표(다른 사이트)
  p.setAttribute('d', kind === 'link'
    ? 'M13 7H8a2 2 0 00-2 2v15a2 2 0 002 2h15a2 2 0 002-2v-5M18 6h8v8M26 6L14 18'
    : kind === 'search'
      ? 'M14 5a9 9 0 110 18 9 9 0 010-18zM20.5 20.5L27 27M10 14h8'
      : kind === 'train'
        ? 'M8 5h16a3 3 0 013 3v11a3 3 0 01-3 3H8a3 3 0 01-3-3V8a3 3 0 013-3zM5 13h22M11 22l-3 5M21 22l3 5M10 17.5h.01M22 17.5h.01'
        : 'M16 4l11 6v12l-11 6-11-6V10l11-6zM5 10l11 6 11-6M16 16v12');
  svg.append(p);
  return svg;
}

function gameCard(g, uid) {
  const b = builtinOf(g);
  const grades = Array.isArray(g.grades) && g.grades.length ? g.grades.join('·') : '모든 학년';
  let action, extra = null;
  if (b) {
    const rec = loadRecord(b.id, uid);
    const stars = totalStars(rec);
    extra = el('p', { class: 'lcard-rec' }, stars
      ? [el('span', { class: 'lcard-star', 'aria-hidden': 'true', text: '★' }), ` 모은 별 ${stars} / ${b.stages * 3}`]
      : '아직 연습하지 않았어요');
    action = el('a', { class: 'btn-primary btn-sm lcard-go', href: b.page, 'aria-label': `${g.title} 시작하기` }, '시작하기');
  } else {
    const host = hostOf(g.url);
    extra = el('p', { class: 'lcard-rec', text: `다른 사이트(${host})로 이동해요` });
    action = el('a', { class: 'btn-line btn-sm lcard-go', href: g.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${g.title} 열기 (새 창, ${host})` }, '열기 ↗');
  }
  return el('article', { class: 'lcard' },
    el('span', { class: 'lcard-icon ' + (b ? 'in' : 'out') }, icon(b ? b.icon || 'builtin' : 'link')),
    el('div', { class: 'lcard-body' },
      el('h3', { text: g.title }),
      g.desc ? el('p', { class: 'lcard-desc', text: g.desc }) : null,
      el('p', { class: 'lcard-meta' }, el('span', { class: 'lcard-grade', text: grades }), g.subject ? el('span', { class: 'lcard-grade', text: g.subject }) : null, b ? el('span', { class: 'lcard-kind', text: '학원 게임' }) : el('span', { class: 'lcard-kind out', text: '링크' })),
      extra),
    action);
}

function emptyBox(title, text) {
  return el('div', { class: 'vempty' }, el('p', {}, el('strong', { text: title })), el('p', { text }));
}

export async function renderLearn(box, st, adminPreview, uid) {
  box.replaceChildren(el('p', { class: 'vstatus', role: 'status', text: '학습 보조 게임을 불러오는 중…' }));
  let list;
  try {
    list = await be.listLearnGames();
  } catch (e) {
    box.replaceChildren(el('p', { class: 'vstatus', role: 'alert', text: friendlyError(e) }));
    return;
  }
  const mine = list
    .filter((g) => g.visible !== false)
    .filter((g) => adminPreview || !Array.isArray(g.grades) || !g.grades.length || g.grades.includes(st.grade))
    .filter((g) => adminPreview || !g.subject || subjectsOf(st).includes(g.subject)) // 과목을 정한 게임은 그 과목 수강생에게만
    .filter((g) => (g.kind === 'link' ? /^https:\/\//.test(g.url || '') : Boolean(builtinOf(g))))
    .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title), 'ko'));
  const head = el('div', { class: 'vhead' },
    el('h2', { text: '학습 보조' }),
    mine.length ? el('span', { class: 'vcount', text: `게임 ${mine.length}개` }) : null);
  if (!mine.length) {
    box.replaceChildren(head, emptyBox(adminPreview ? '학생에게 보이는 학습 보조 게임이 없어요.' : `아직 ${st.grade} 학습 보조 게임이 없어요.`,
      adminPreview ? '선생님 화면 → 학습 보조에서 게임을 등록하고 \'학생에게 보이기\'를 켜 주세요.' : '선생님이 게임을 올리면 이곳에 보여요.'));
    return;
  }
  box.replaceChildren(...[head,
    adminPreview ? el('p', { class: 'learn-note', text: '미리보기에서는 학생에게 보이는 게임이 학년과 상관없이 모두 보여요.' }) : null,
    el('div', { class: 'lgrid' }, mine.map((g) => gameCard(g, uid))),
    el('p', { class: 'learn-note', text: '혼자 연습하는 게임이에요. 학원 게임의 연습 기록(별)은 이 기기의 브라우저에만 저장돼요.' })].filter(Boolean));
}
