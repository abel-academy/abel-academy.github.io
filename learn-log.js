// 학습 보조 게임: 학생이 한 단계를 끝까지 풀면 선생님이 볼 수 있도록 1건 기록해요.
// (게임·단계·맞힌 문제 수·걸린 시간·날짜와 시각. 선생님 미리보기는 기록하지 않아요)
// 기록에 실패해도 게임은 그대로 계속돼요.
import * as be from './backend.js';

let player = null;

export function setPlayer(st) {
  player = st && st.active && st.uid ? st : null;
}

export function logPlay(game, stage, correct, total, sec) {
  if (!player || typeof be.recordLearnPlay !== 'function') return;
  const n = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
  const t = n(total, 1, 50);
  be.recordLearnPlay(player, { game, stage: n(stage, 1, 10), correct: n(correct, 0, t), total: t, sec: n(sec, 0, 86400) })
    .catch((e) => console.warn('학습 기록 실패', e));
}
