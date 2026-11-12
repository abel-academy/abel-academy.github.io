// 학습 보조 게임을 누가 할 수 있는지 (학습 보조 탭과 게임 화면이 같은 규칙을 써요)
// 게임은 모든 학생에게 보이지만, 선생님이 정한 학년이면서 정한 과목을 수강하는 학생만 할 수 있어요.
// (학년을 하나도 안 골랐으면 모든 학년, 과목이 '모든 과목'이면 과목은 따지지 않아요)
import { subjectsOf } from './common.js';

const gradesOf = (g) => (Array.isArray(g.grades) ? g.grades : []);

export function canPlay(g, st) {
  const gr = gradesOf(g);
  const gradeOk = !gr.length || gr.includes(st.grade);
  const subjOk = !g.subject || subjectsOf(st).includes(g.subject);
  return gradeOk && subjOk;
}

// '초6 학생 중 영어 수강생만 할 수 있어요' 같은 안내
export function whoCanPlay(g) {
  const gr = gradesOf(g);
  const gt = gr.length ? `${gr.join('·')} 학생` : '';
  if (gt && g.subject) return `${gt} 중 ${g.subject} 수강생만 할 수 있어요`;
  if (gt) return `${gt}만 할 수 있어요`;
  if (g.subject) return `${g.subject} 수강생만 할 수 있어요`;
  return '모든 학생이 할 수 있어요';
}

// 게임 화면에서: 이 학원 게임을 이 학생이 할 수 있는지 (등록된 것 중 하나라도 맞으면 할 수 있어요)
export function checkBuiltin(list, gameId, st) {
  const mine = list.filter((g) => g.kind === 'builtin' && g.builtin === gameId);
  const shown = mine.filter((g) => g.visible !== false);
  if (!shown.length) return { ok: false, text: mine.length ? '지금은 선생님이 숨겨 둔 게임이에요.' : '아직 선생님이 학습 보조에 올리지 않은 게임이에요.' };
  if (shown.some((g) => canPlay(g, st))) return { ok: true };
  return { ok: false, text: `이 게임은 ${whoCanPlay(shown[0])}. 학습 보조 탭에서 내 학년·수강 과목에 맞는 게임을 골라 보세요.` };
}
