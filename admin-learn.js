// 선생님 화면 → 학습 보조: 학생 전용 '학습 보조' 탭에 보일 게임 등록·순서·보이기·삭제
import * as be from './backend.js';
import { GRADES_ALL, GRADE_GROUPS, SUBJECTS, el, friendlyError } from './common.js';
import { LEARN_BUILTINS, LEARN_MAX } from './learn-games.js';

const $ = (s) => document.querySelector(s);
let games = null;

function message(node, text, kind) {
  node.textContent = text || '';
  node.className = 'a-msg ' + (kind || 'ok');
  node.hidden = !text;
}

const builtinOf = (g) => (g.kind === 'builtin' ? LEARN_BUILTINS.find((b) => b.id === g.builtin) : null);
const sorted = () => [...(games || [])].sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title), 'ko'));
const nextOrder = () => Math.max(0, ...(games || []).map((g) => Number(g.order) || 0)) + 1;
function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }
const subjText = (s) => (s ? `${s} 수강생` : '모든 과목');
function gradeText(gr) {
  if (!Array.isArray(gr) || !gr.length || gr.length === GRADES_ALL.length) return '모든 학년';
  for (const [name, list] of GRADE_GROUPS) if (gr.length === list.length && list.every((x) => gr.includes(x))) return name;
  return GRADES_ALL.filter((x) => gr.includes(x)).join('·');
}

export async function loadLearn(force) {
  if (force || !games) games = await be.listLearnGames();
  render();
}

function render() {
  renderSuggest();
  const list = sorted();
  $('#lg-count').textContent = `${list.length}개`;
  if (!list.length) {
    $('#lg-list').replaceChildren(el('p', { class: 'empty', text: '아직 등록한 게임이 없어요. 위에서 등록하면 학생 전용 → 학습 보조 탭에 보여요.' }));
    return;
  }
  $('#lg-list').replaceChildren(el('ul', { class: 'lg-items' }, list.map((g, i) => row(g, i, list))));
}

// 아직 등록하지 않은 학원 게임은 한 번에 등록할 수 있게 안내
function renderSuggest() {
  const missing = LEARN_BUILTINS.filter((b) => !(games || []).some((g) => g.kind === 'builtin' && g.builtin === b.id));
  $('#lg-suggest').replaceChildren(...missing.map((b) => {
    const btn = el('button', { type: 'button', class: 'a-btn small primary', text: '바로 등록하기' });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await add({ kind: 'builtin', builtin: b.id, title: b.title, desc: b.desc, grades: [...b.grades], url: '', visible: true, ...(b.subject ? { subject: b.subject } : {}) });
        message($('#lg-msg'), `'${b.title}'을(를) ${gradeText(b.grades)}${b.subject ? ` ${b.subject} 수강` : ''} 학생에게 보이도록 등록했어요.`, 'ok');
      } catch (e) { alert(friendlyError(e)); btn.disabled = false; }
    });
    return el('div', { class: 'alert lg-suggest', role: 'status' },
      el('span', {}, el('strong', { text: `추천: ${b.title}` }), ` — ${gradeText(b.grades)}(${b.grades.join('·')})${b.subject ? ` ${b.subject} 수강` : ''} 학생에게 보여 줄 수 있어요.`),
      btn);
  }));
}

function row(g, i, list) {
  const b = builtinOf(g);
  const up = el('button', { type: 'button', class: 'a-btn small', text: '↑', 'aria-label': `${g.title} 위로`, disabled: i === 0 });
  const down = el('button', { type: 'button', class: 'a-btn small', text: '↓', 'aria-label': `${g.title} 아래로`, disabled: i === list.length - 1 });
  up.addEventListener('click', () => swap(list, i, i - 1, `${g.title} 위로`));
  down.addEventListener('click', () => swap(list, i, i + 1, `${g.title} 아래로`));
  const vis = el('button', { type: 'button', class: 'lg-toggle', 'aria-pressed': String(g.visible !== false), 'aria-label': `${g.title} 학생에게 보이기` },
    el('span', { class: 'lg-toggle-dot', 'aria-hidden': 'true' }), g.visible !== false ? '보임' : '숨김');
  vis.addEventListener('click', async () => {
    vis.disabled = true;
    try {
      const next = g.visible === false;
      await be.updateLearnGame(g.id, { visible: next });
      g.visible = next;
      render();
      $(`[aria-label="${CSS.escape(g.title)} 학생에게 보이기"]`)?.focus();
    } catch (e) { alert(friendlyError(e)); vis.disabled = false; }
  });
  const open = b
    ? el('a', { class: 'a-btn small', href: b.page, target: '_blank', rel: 'noopener', text: '열어 보기' })
    : el('a', { class: 'a-btn small', href: g.url, target: '_blank', rel: 'noopener noreferrer', text: '열어 보기 ↗' });
  // 과목 바꾸기 (고르면 그 과목 수강생에게만 보여요)
  const subj = el('select', { class: 'a-input lg-subj', 'aria-label': `${g.title} 과목`, style: 'width:auto;min-height:34px;padding:0 8px;font-size:13px;' },
    el('option', { value: '', text: '모든 과목' }), SUBJECTS.map((s) => el('option', { value: s, text: `${s} 수강생` })));
  subj.value = g.subject || '';
  subj.addEventListener('change', async () => {
    subj.disabled = true;
    try {
      await be.updateLearnGame(g.id, { subject: subj.value });
      g.subject = subj.value;
      render();
      message($('#lg-msg'), `'${g.title}'은(는) 이제 ${subj.value ? `${subj.value} 수강생에게만` : '과목과 상관없이'} 보여요.`, 'ok');
      $(`[aria-label="${CSS.escape(g.title)} 과목"]`)?.focus();
    } catch (e) { alert(friendlyError(e) + (e.code === 'permission-denied' ? ' — Firebase 보안 규칙을 새 내용으로 게시했는지 확인해 주세요.' : '')); subj.value = g.subject || ''; subj.disabled = false; }
  });
  const del = el('button', { type: 'button', class: 'a-btn small danger', text: '삭제', 'aria-label': `${g.title} 삭제` });
  del.addEventListener('click', async () => {
    if (!confirm(`'${g.title}'을(를) 학습 보조에서 삭제할까요?${b ? ' (게임 자체와 학생들의 연습 기록은 그대로예요)' : ''}`)) return;
    del.disabled = true;
    try { await be.deleteLearnGame(g.id); games = games.filter((x) => x.id !== g.id); render(); message($('#lg-msg'), `'${g.title}'을(를) 삭제했어요.`, 'ok'); }
    catch (e) { alert(friendlyError(e)); del.disabled = false; }
  });
  return el('li', { class: 'lg-item' + (g.visible === false ? ' off' : '') },
    el('div', { class: 'lg-order' }, up, down),
    el('div', { class: 'lg-main' },
      el('strong', { text: g.title }),
      g.desc ? el('span', { class: 'lg-desc', text: g.desc }) : null,
      el('span', { class: 'lg-meta' },
        el('span', { class: 'pill', text: b ? '학원 게임' : '링크' }),
        ` ${b ? b.page : hostOf(g.url)} · ${gradeText(g.grades)} · ${subjText(g.subject)}`)),
    el('div', { class: 'lg-acts' }, vis, subj, open, del));
}

async function swap(list, a, b, label) {
  const x = list[a], y = list[b];
  if (!x || !y) return;
  let ox = Number(x.order) || 0, oy = Number(y.order) || 0;
  if (ox === oy) { ox = a + 1; oy = b + 1; } // 순서가 같으면 지금 보이는 순서대로 다시 매김
  try {
    await Promise.all([be.updateLearnGame(x.id, { order: oy }), be.updateLearnGame(y.id, { order: ox })]);
    x.order = oy; y.order = ox;
    render();
    $(`[aria-label="${CSS.escape(label)}"]`)?.focus();
  } catch (e) { alert(friendlyError(e)); }
}

async function add(g) {
  if ((games || []).length >= LEARN_MAX) throw Object.assign(new Error('too many'), { code: 'app/too-many' });
  const data = { ...g, order: nextOrder() };
  const id = await be.addLearnGame(data);
  games = [...(games || []), { id, ...data }];
  render();
}

/* ── 등록 양식 ── */
const kindNow = () => document.querySelector('input[name="lg-kind"]:checked').value;
let autoFilled = '', autoDesc = '', autoGrades = '', autoSubject = '';
const checkedGrades = () => [...document.querySelectorAll('input[name="lg-grade"]:checked')].map((c) => c.value).join(',');
function syncKind() {
  const k = kindNow();
  $('#lg-builtin-fld').hidden = k !== 'builtin';
  $('#lg-url-fld').hidden = k !== 'link';
  if (k === 'builtin') fillBuiltin();
  // 다른 사이트 링크로 바꾸면, 학원 게임 때문에 자동으로 골라 둔 과목은 비움
  const ss = $('#lg-subject');
  if (k === 'link' && ss && autoSubject && ss.value === autoSubject) { ss.value = ''; autoSubject = ''; }
}
function fillBuiltin() {
  const b = LEARN_BUILTINS.find((x) => x.id === $('#lg-builtin').value);
  if (!b) return;
  // 비어 있거나 전에 자동으로 넣은 값 그대로일 때만 바꿈 (선생님이 고친 값은 그대로 둠)
  if (!$('#lg-title').value.trim() || $('#lg-title').value === autoFilled) { $('#lg-title').value = b.title; autoFilled = b.title; }
  if (!$('#lg-desc').value.trim() || $('#lg-desc').value === autoDesc) { $('#lg-desc').value = b.desc; autoDesc = b.desc; }
  const cur = checkedGrades();
  if (!cur || cur === autoGrades) { setGrades(b.grades); autoGrades = checkedGrades(); }
  const ss = $('#lg-subject');
  if (ss && (!ss.value || ss.value === autoSubject)) { ss.value = b.subject || ''; autoSubject = ss.value; }
}
function setGrades(list) {
  document.querySelectorAll('input[name="lg-grade"]').forEach((c) => { c.checked = list.includes(c.value); });
}
// 등록 양식 연결 (예전 admin.html이 브라우저에 남아 있어 양식이 없으면 건너뜀 — 선생님 화면 전체가 멈추지 않게)
if ($('#lg-form')) {
$('#lg-builtin').replaceChildren(...LEARN_BUILTINS.map((b) => el('option', { value: b.id, text: b.title })));
document.querySelectorAll('input[name="lg-kind"]').forEach((r) => r.addEventListener('change', syncKind));
$('#lg-builtin').addEventListener('change', fillBuiltin);
document.querySelectorAll('[data-gq]').forEach((b) => b.addEventListener('click', () => {
  const grp = GRADE_GROUPS.find(([name]) => name === b.dataset.gq);
  if (!grp) { setGrades([]); return; }
  const cur = [...document.querySelectorAll('input[name="lg-grade"]:checked')].map((c) => c.value);
  setGrades([...new Set([...cur, ...grp[1]])]);
}));
syncKind();

$('#lg-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#lg-msg');
  const kind = kindNow();
  const title = $('#lg-title').value.trim();
  const desc = $('#lg-desc').value.trim();
  const grades = [...document.querySelectorAll('input[name="lg-grade"]:checked')].map((c) => c.value);
  const visible = $('#lg-visible').checked;
  const subject = $('#lg-subject') ? $('#lg-subject').value : '';
  let url = '', builtin = '';
  if (kind === 'link') {
    url = $('#lg-url').value.trim();
    let ok = false;
    try { const u = new URL(url); ok = u.protocol === 'https:' && Boolean(u.hostname) && !/\s/.test(url); } catch { ok = false; }
    if (!ok) { message(msg, '게임 주소는 https:// 로 시작하는 올바른 주소여야 해요.', 'err'); $('#lg-url').focus(); return; }
    if ((games || []).some((g) => g.kind === 'link' && g.url === url)) { message(msg, '이미 등록한 주소예요.', 'err'); return; }
  } else {
    builtin = $('#lg-builtin').value;
  }
  if (!title) { message(msg, '이름을 적어 주세요.', 'err'); $('#lg-title').focus(); return; }
  const btn = $('#lg-form button[type="submit"]');
  btn.disabled = true;
  try {
    await add({ kind, builtin, url, title, desc, grades, visible, ...(subject ? { subject } : {}) });
    message(msg, `'${title}'을(를) 등록했어요. ${visible ? `${gradeText(grades)}${subject ? ` ${subject} 수강` : ''} 학생의 학습 보조 탭에 보여요.` : '지금은 숨김 상태예요.'}`, 'ok');
    $('#lg-form').reset();
    autoFilled = ''; autoDesc = ''; autoGrades = ''; autoSubject = '';
    syncKind();
  } catch (err) {
    message(msg, err.code === 'app/too-many' ? `게임은 ${LEARN_MAX}개까지 등록할 수 있어요.` : friendlyError(err) + (err.code === 'permission-denied' ? ' — Firebase 보안 규칙을 새 내용으로 게시했는지 확인해 주세요.' : ''), 'err');
  } finally {
    btn.disabled = false;
  }
});
}
