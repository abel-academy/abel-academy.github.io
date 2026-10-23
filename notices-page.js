// 공지사항 페이지: 전체 공지를 최신순으로, 제목을 누르면 내용과 사진이 펼쳐짐
import * as be from './backend.js';
import { el, formatDate } from './common.js';

const box = document.getElementById('notice-list');

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

// 사진은 공지를 펼칠 때 불러옴 (처음 화면을 빠르게)
async function loadImages(n, holder) {
  holder.replaceChildren(el('p', { class: 'news-loading', text: '사진을 불러오는 중…' }));
  try {
    const imgs = await be.getNoticeImages(n.id);
    holder.replaceChildren(...imgs.map((im, i) => el('img', {
      src: im.data, alt: `${n.title} 사진 ${i + 1}`, width: String(im.w || ''), height: String(im.h || ''), loading: 'lazy', decoding: 'async'
    })));
  } catch (e) {
    holder.replaceChildren(el('p', { class: 'news-loading', text: '사진을 불러오지 못했어요. 새로고침해 주세요.' }));
  }
}

function item(n) {
  const body = el('div', { class: 'news-detail' });
  if (n.body) body.append(el('p', { class: 'news-body', text: n.body }));
  const holder = n.imageCount ? el('div', { class: 'news-imgs' }) : null;
  if (holder) body.append(holder);
  if (!n.body && !holder) body.append(el('p', { class: 'news-body', text: '자세한 내용은 학원(010-2078-7098)으로 문의해 주세요.' }));
  const d = el('details', { id: `n-${n.id}` },
    el('summary', {},
      el('span', { class: 'news-cat', text: n.category || '공지' }),
      el('span', { class: 'news-title' }, n.title, n.imageCount ? el('span', { class: 'news-pic', text: `사진 ${n.imageCount}` }) : null),
      el('time', { datetime: n.date || null, text: formatDate(n.date) }),
      chevron()),
    body);
  let loaded = false;
  d.addEventListener('toggle', () => { if (d.open && holder && !loaded) { loaded = true; loadImages(n, holder); } });
  return el('li', {}, d);
}

function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id.startsWith('n-')) return;
  const d = document.getElementById(id);
  if (d && d.tagName === 'DETAILS') { d.open = true; d.scrollIntoView({ block: 'start' }); d.querySelector('summary').focus({ preventScroll: true }); }
}

if (box && be.configured) {
  be.listNotices(100)
    .then((list) => {
      if (!list.length) return;
      box.replaceChildren(el('ul', { class: 'news news-page' }, list.map(item)));
      openFromHash();
    })
    .catch((e) => console.warn('공지사항을 불러오지 못했어요', e));
  window.addEventListener('hashchange', openFromHash);
}
