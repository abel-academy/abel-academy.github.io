// 학습 보조 게임의 연습 기록: 이 기기(브라우저)에만 저장 (서버로 보내지 않음)
const PREFIX = 'abel-learn:';
const keyOf = (gameId, uid) => `${PREFIX}${gameId}:${uid || 'guest'}`;

export function loadRecord(gameId, uid) {
  try {
    const v = JSON.parse(localStorage.getItem(keyOf(gameId, uid)) || 'null');
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}

export function saveRecord(gameId, uid, rec) {
  try { localStorage.setItem(keyOf(gameId, uid), JSON.stringify(rec)); return true; } catch { return false; }
}

// 단계별 별(0~3)을 모두 더한 값
export function totalStars(rec) {
  return Object.values((rec && rec.stages) || {}).reduce((a, s) => a + (Number(s.stars) || 0), 0);
}
