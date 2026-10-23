// 홈 화면 '학원 소식': 관리자가 올린 공지가 있을 때만 최신 5개를 보여 줌 (없으면 '아직 올라온 소식이 없어요')
// 제목을 누르면 공지사항 페이지의 해당 공지로 이동
import * as be from './backend.js';
import { el, formatDate } from './common.js';

const box = document.getElementById('news-list');
const SHOW = 5;

function item(n) {
  return el('li', {}, el('a', { class: 'news-row', href: `notices.html#n-${n.id}` },
    el('span', { class: 'news-cat', text: n.category || '공지' }),
    el('span', { class: 'news-title' }, n.title, n.imageCount ? el('span', { class: 'news-pic', text: `사진 ${n.imageCount}` }) : null),
    el('time', { datetime: n.date || null, text: formatDate(n.date) })
  ));
}

if (box && be.configured) {
  be.listNotices(SHOW)
    .then((list) => { if (list.length) box.replaceChildren(el('ul', { class: 'news' }, list.map(item))); })
    .catch((e) => console.warn('학원 소식을 불러오지 못했어요', e));
}
