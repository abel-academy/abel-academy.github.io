// 학습 보조: 선생님이 '별 초기화'를 하면 학생 문서(students/{uid}.starReset)에 시각이 남아요.
//   starReset = { '<게임 id>': 시각, all: 시각 }   (all = 모든 게임)
// 학생 기기에서 게임이나 학습 보조 탭을 열 때, 아직 반영하지 않은 초기화가 있으면
// 그 게임의 별·최고 기록(단계별 기록)을 지워요. 이미 푼 문제 목록(seen)은 남겨 둬요.
import { loadRecord, saveRecord } from './learn-records.js';

const ms = (v) => {
  if (v == null) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return Date.parse(v) || 0;
};

// 이 게임에 마지막으로 한 초기화 시각 (없으면 0)
export function resetTime(st, gameId) {
  const m = (st && st.starReset) || {};
  return Math.max(ms(m[gameId]), ms(m.all));
}

// 지웠으면 true
export function applyStarReset(gameId, uid, st) {
  const t = resetTime(st, gameId);
  if (!t || !uid) return false;
  const rec = loadRecord(gameId, uid);
  if ((Number(rec.resetApplied) || 0) >= t) return false;
  const had = Boolean(rec.stages && Object.keys(rec.stages).length);
  rec.stages = {};
  rec.resetApplied = t;
  saveRecord(gameId, uid, rec);
  return had;
}
