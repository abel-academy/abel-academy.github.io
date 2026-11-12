// 학생 전용 → 학습 보조 탭: 선생님이 등록한 게임 (모두 보이고, 내 학년·수강 과목에 맞는 것만 할 수 있음)
import * as be from './backend.js';
import { el, friendlyError, subjectsOf, SUBJECT_CLASS } from './common.js';
import { LEARN_BUILTINS } from './learn-games.js';
import { canPlay, whoCanPlay } from './learn-access.js';
import { loadRecord, totalStars } from './learn-records.js';

const builtinOf = (g) => (g.kind === 'builtin' ? LEARN_BUILTINS.find((b) => b.id === g.builtin) : null);
// 아이콘 색을 정할 과목: 선생님이 정한 과목, 없으면 학원 게임의 원래 과목 (국어 주황 · 영어 노랑 · 수학 파랑)
const colorSubject = (g, b) => g.subject || (b && b.subject) || '';

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

// locked: 이 학생의 학년·수강 과목과 맞지 않아 구경만 하는 카드 / who: 선생님 미리보기에서 누가 할 수 있는지 안내
function gameCard(g, uid, locked, who) {
  const b = builtinOf(g);
  const grades = Array.isArray(g.grades) && g.grades.length ? g.grades.join('·') : '모든 학년';
  let action, extra = null;
  if (locked) {
    extra = el('p', { class: 'lcard-lock' }, el('span', { 'aria-hidden': 'true', text: '🔒 ' }), whoCanPlay(g));
    action = el('span', { class: 'lcard-locktag', text: '잠김' });
  } else if (b) {
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
  return el('article', { class: 'lcard' + (locked ? ' locked' : '') },
    el('span', { class: 'lcard-icon ' + (b ? 'in' : 'out') + (SUBJECT_CLASS[colorSubject(g, b)] ? ' s-' + SUBJECT_CLASS[colorSubject(g, b)] : '') }, icon(b ? b.icon || 'builtin' : 'link')),
    el('div', { class: 'lcard-body' },
      el('h3', { text: g.title }),
      g.desc ? el('p', { class: 'lcard-desc', text: g.desc }) : null,
      el('p', { class: 'lcard-meta' }, el('span', { class: 'lcard-grade', text: grades }), g.subject ? el('span', { class: 'subj subj-' + (SUBJECT_CLASS[g.subject] || 'etc'), text: g.subject }) : null, b ? el('span', { class: 'lcard-kind', text: '학원 게임' }) : el('span', { class: 'lcard-kind out', text: '링크' })),
      who ? el('p', { class: 'lcard-rec', text: whoCanPlay(g) }) : null,
      extra),
    action);
}

function emptyBox(title, text) {
  return el('div', { class: 'vempty' }, el('p', {}, el('strong', { text: title })), el('p', { text }));
}

// 게임은 모두에게 보이고, 내 학년·수강 과목에 맞는 게임만 할 수 있어요 (규칙은 learn-access.js)
export async function renderLearn(box, st, adminPreview, uid) {
  box.replaceChildren(el('p', { class: 'vstatus', role: 'status', text: '학습 보조 게임을 불러오는 중…' }));
  let list;
  try {
    list = await be.listLearnGames();
  } catch (e) {
    box.replaceChildren(el('p', { class: 'vstatus', role: 'alert', text: friendlyError(e) }));
    return;
  }
  const all = list
    .filter((g) => g.visible !== false)
    .filter((g) => (g.kind === 'link' ? /^https:\/\//.test(g.url || '') : Boolean(builtinOf(g))))
    .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title), 'ko'));
  const head = el('div', { class: 'vhead' },
    el('h2', { text: '학습 보조' }),
    all.length ? el('span', { class: 'vcount', text: `게임 ${all.length}개` }) : null);
  if (!all.length) {
    box.replaceChildren(head, emptyBox(adminPreview ? '학생에게 보이는 학습 보조 게임이 없어요.' : '아직 학습 보조 게임이 없어요.',
      adminPreview ? '선생님 화면 → 학습 보조에서 게임을 등록하고 \'학생에게 보이기\'를 켜 주세요.' : '선생님이 게임을 올리면 이곳에 보여요.'));
    return;
  }
  const note = el('p', { class: 'learn-note', text: '혼자 연습하는 게임이에요. 학원 게임의 연습 기록(별)은 이 기기의 브라우저에만 저장돼요.' });
  if (adminPreview) {
    box.replaceChildren(head,
      el('p', { class: 'learn-note', text: '미리보기에서는 모든 게임을 할 수 있어요. 학생은 모든 게임을 볼 수 있지만, 카드에 적힌 학년·과목에 맞는 게임만 할 수 있어요.' }),
      el('div', { class: 'lgrid' }, all.map((g) => gameCard(g, uid, false, true))), note);
    return;
  }
  const open = all.filter((g) => canPlay(g, st)), locked = all.filter((g) => !canPlay(g, st));
  box.replaceChildren(...[head,
    el('h3', { class: 'learn-sub', text: `내가 할 수 있는 게임 ${open.length}개` }),
    open.length
      ? el('div', { class: 'lgrid' }, open.map((g) => gameCard(g, uid, false)))
      : el('p', { class: 'learn-note first', text: `지금은 ${st.grade}${subjectsOf(st).length ? ` · ${subjectsOf(st).join('·')} 수강` : ''}에 맞는 게임이 없어요. 선생님이 게임을 올리면 이곳에서 할 수 있어요.` }),
    locked.length ? el('h3', { class: 'learn-sub', text: `다른 학년·과목 게임 ${locked.length}개` }) : null,
    locked.length ? el('p', { class: 'learn-note first', text: '구경만 할 수 있어요. 카드에 적힌 학년이면서 그 과목을 수강하는 학생이 할 수 있어요.' }) : null,
    locked.length ? el('div', { class: 'lgrid' }, locked.map((g) => gameCard(g, uid, true))) : null,
    note].filter(Boolean));
}
