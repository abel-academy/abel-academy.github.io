// 홈 화면 '학원 소식': 관리자가 올린 공지가 있을 때만 목록으로 보여 줌 (없으면 '아직 올라온 소식이 없어요')
import * as be from './backend.js';
import { el, formatDate } from './common.js';

const box = document.getElementById('news-list');
const SHOW = 5;

function chevron() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'chev'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '18'); svg.setAttribute('height', '18'); svg.setAttribute('viewBox', '0 0 18 18'); svg.setAttribute('fill', 'none');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M4.5 7l4.5 4.5L13.5 7'); path.setAttribute('stroke', '#141414'); path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

function item(n) {
  const head = [
    el('span', { class: 'news-cat', text: n.category || '공지' }),
    el('span', { class: 'news-title', text: n.title }),
    el('time', { datetime: n.date || null, text: formatDate(n.date) })
  ];
  if (!n.body) return el('li', {}, el('div', { class: 'news-row' }, head));
  return el('li', {}, el('details', {},
    el('summary', {}, head, chevron()),
    el('p', { class: 'news-body', text: n.body })
  ));
}

if (box && be.configured) {
  be.listNotices(SHOW)
    .then((list) => { if (list.length) box.replaceChildren(el('ul', { class: 'news' }, list.map(item))); })
    .catch((e) => console.warn('학원 소식을 불러오지 못했어요', e));
}
