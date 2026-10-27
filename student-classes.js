// 학생 전용 → 클래스 탭: 내가 들어간 클래스의 숙제 공지, 내 스탬프, 스탬프 규칙·상품
// (다른 학생의 스탬프는 보이지 않음)
import * as be from './backend.js';
import { SUBJECT_CLASS, formatDate, dueInfo, stampMaxOf, el, friendlyError } from './common.js';

const STAMP_COLORS = ['stamp-o', 'stamp-y', 'stamp-b'];

function star() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20'); svg.setAttribute('width', '20'); svg.setAttribute('height', '20'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', 'M10 2.8l2.1 4.4 4.8.6-3.5 3.3.9 4.8L10 13.6l-4.3 2.3.9-4.8-3.5-3.3 4.8-.6L10 2.8z');
  p.setAttribute('fill', 'currentColor');
  svg.append(p);
  return svg;
}

function shortDate(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getMonth() + 1}.${x.getDate()}`;
}

// 스탬프 판: 클래스마다 정한 칸 수(최대 개수)만큼, 받은 개수는 도장으로
function stampBoard(count, max) {
  const shown = Math.min(count, max);
  const board = el('div', { class: 'stamp-board', role: 'img', 'aria-label': `스탬프판 ${max}칸 중 ${shown}칸을 채웠어요` });
  for (let i = 0; i < max; i++) {
    board.append(i < shown
      ? el('span', { class: 'stamp ' + STAMP_COLORS[i % 3] }, star())
      : el('span', { class: 'stamp empty' }));
  }
  return board;
}

function stampCard(c) {
  const n = c.stamps.length;
  const max = stampMaxOf(c);
  const full = n >= max;
  const recent = c.stamps.slice(0, 8);
  return el('section', { class: 'cls-card' + (full ? ' stamp-full' : ''), 'aria-label': '내 스탬프' },
    el('div', { class: 'cls-card-head' },
      el('h3', { text: '내 스탬프' }),
      el('p', { class: 'stamp-count' }, el('strong', { text: String(Math.min(n, max)) }), ` / ${max}개`)),
    full
      ? el('p', { class: 'stamp-done', role: 'status' }, star(), el('span', { text: c.prize ? `스탬프판을 다 채웠어요! 상품: ${c.prize} — 선생님께 알려 주세요.` : '스탬프판을 다 채웠어요! 선생님께 알려 주세요.' }))
      : el('p', { class: 'stamp-left', text: `${max - n}개만 더 모으면 스탬프판을 다 채워요.` }),
    stampBoard(n, max),
    c.prize && !full ? el('p', { class: 'prize-line' }, el('span', { class: 'prize-tag', text: '🎁 다 모으면' }), ' ', el('strong', { text: c.prize })) : null,
    n
      ? el('div', { class: 'stamp-log-wrap' },
          el('h4', { text: '최근 받은 스탬프' }),
          el('ul', { class: 'stamp-log' }, recent.map((s) => el('li', {},
            el('time', { datetime: s.createdAt ? new Date(s.createdAt).toISOString() : null, text: shortDate(s.createdAt) }),
            el('span', { text: s.reason || '칭찬 스탬프' })))))
      : el('p', { class: 'cls-empty', text: '아직 받은 스탬프가 없어요. 수업 시간에 열심히 하면 선생님이 스탬프를 찍어 줘요!' })
  );
}

function homeworkCard(c) {
  const list = c.homework;
  return el('section', { class: 'cls-card', 'aria-label': '숙제 공지' },
    el('div', { class: 'cls-card-head' },
      el('h3', { text: '숙제 공지' }),
      list.length ? el('span', { class: 'cls-sub', text: `${list.length}개` }) : null),
    list.length
      ? el('ul', { class: 'hw-list' }, list.map((h, i) => {
          const due = dueInfo(h.due);
          const d = el('details', { open: i === 0 ? true : null },
            el('summary', {},
              el('span', { class: 'hw-main' },
                el('span', { class: 'hw-title', text: h.title }),
                el('span', { class: 'hw-meta', text: `${formatDate(h.date)} 올림` + (due ? ` · 마감 ${due.date}` : '') })),
              due ? el('span', { class: 'due due-' + due.kind, text: due.text }) : null),
            el('p', { class: 'hw-body', text: h.body || '자세한 내용은 수업 시간에 안내해요.' }));
          return el('li', {}, d);
        }))
      : el('p', { class: 'cls-empty', text: '올라온 숙제가 없어요.' })
  );
}

// 스탬프 규칙: 어떤 때 스탬프를 받는지 (선생님이 적어 둔 규칙, 반 학생 모두에게 보임)
function rulesCard(c) {
  const rules = Array.isArray(c.stampRules) ? c.stampRules : [];
  if (!rules.length && !c.prize) return null;
  return el('section', { class: 'cls-card cls-rules', 'aria-label': '스탬프 규칙' },
    el('div', { class: 'cls-card-head' }, el('h3', { text: '스탬프 받는 방법' })),
    rules.length
      ? el('ol', { class: 'rule-list' }, rules.map((r) => el('li', { text: r })))
      : el('p', { class: 'cls-empty', text: '선생님이 수업 시간에 알려 줘요.' }),
    c.prize ? el('p', { class: 'prize-box' }, el('span', { class: 'prize-tag', text: `🎁 스탬프 ${stampMaxOf(c)}개를 다 모으면` }), el('strong', { text: c.prize })) : null
  );
}

function classPanel(c) {
  return el('article', { class: 'cls' },
    el('header', { class: 'cls-top' },
      el('span', { class: 'subj subj-' + (SUBJECT_CLASS[c.subject] || 'etc'), text: c.subject || '기타' }),
      el('h2', { text: c.name }),
      c.memo ? el('p', { class: 'cls-memo', text: c.memo }) : null),
    el('div', { class: 'cls-grid' }, homeworkCard(c), stampCard(c)),
    rulesCard(c)
  );
}

function emptyBox(title, text) {
  return el('div', { class: 'vempty' }, el('p', {}, el('strong', { text: title })), el('p', { text }));
}

export async function renderClasses(box, student, adminPreview) {
  if (adminPreview) {
    box.replaceChildren(emptyBox('선생님 미리보기에서는 클래스가 보이지 않아요.', '학생 계정으로 로그인하면 그 학생이 들어간 클래스의 숙제와 스탬프가 보여요.'));
    return;
  }
  box.replaceChildren(el('p', { class: 'vstatus', role: 'status', text: '클래스를 불러오는 중…' }));
  let classes;
  try {
    classes = await be.myClasses(student);
  } catch (e) {
    box.replaceChildren(el('p', { class: 'vstatus', role: 'alert', text: friendlyError(e) }));
    return;
  }
  if (!classes.length) {
    box.replaceChildren(emptyBox('아직 배정된 클래스가 없어요.', '선생님이 클래스에 넣어 주면 이곳에서 숙제 공지와 내 스탬프를 볼 수 있어요.'));
    return;
  }
  if (classes.length === 1) { box.replaceChildren(classPanel(classes[0])); return; }

  // 클래스가 여러 개면 위에서 골라 보기
  const holder = el('div');
  const chips = classes.map((c, i) => el('button', {
    type: 'button', role: 'tab', class: 'cls-chip', id: `cls-chip-${i}`, 'aria-controls': 'cls-panel',
    'aria-selected': String(i === 0), tabindex: i === 0 ? '0' : '-1'
  }, c.name, el('span', { class: 'cls-chip-n', 'aria-label': `스탬프 ${Math.min(c.stamps.length, stampMaxOf(c))}/${stampMaxOf(c)}개`, text: `★ ${Math.min(c.stamps.length, stampMaxOf(c))}/${stampMaxOf(c)}` })));
  const panel = el('div', { role: 'tabpanel', id: 'cls-panel', 'aria-labelledby': 'cls-chip-0' });
  const pick = (i, focus) => {
    chips.forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; });
    panel.setAttribute('aria-labelledby', `cls-chip-${i}`);
    panel.replaceChildren(classPanel(classes[i]));
    if (focus) chips[i].focus();
  };
  chips.forEach((b, i) => {
    b.addEventListener('click', () => pick(i));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      pick((i + (e.key === 'ArrowRight' ? 1 : chips.length - 1)) % chips.length, true);
    });
  });
  holder.append(el('div', { class: 'cls-chips', role: 'tablist', 'aria-label': '내 클래스' }, chips), panel);
  box.replaceChildren(holder);
  pick(0);
}
