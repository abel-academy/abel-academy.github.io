// 접속 기록: 로그인 상태가 브라우저에 저장돼 있어서 로그인 화면을 거치지 않아도
// '홈페이지에 들어올 때마다' 접속 1건을 남겨요.
// 한 번 들어와서 여러 페이지를 둘러보는 동안은 1건이고, 30분 넘게 쉬었다가(창을 닫거나 다른 앱을 보다가)
// 다시 들어오면 새 접속으로 1건 더 남겨요. (구글 애널리틱스의 '세션'과 같은 기준)
import * as be from './backend.js';

const GAP = 30 * 60 * 1000;      // 이만큼 쉬었다가 들어오면 새 접속
const BEAT = 5 * 60 * 1000;      // 페이지를 보고 있는 동안 '아직 보는 중'을 적어 두는 간격
const key = (uid) => `abel-visit:${uid}`;
const memory = {};               // 브라우저 저장소를 못 쓸 때 대신

function lastSeen(uid) {
  try { const v = localStorage.getItem(key(uid)); if (v != null) return Number(v) || 0; } catch { /* 저장소 막힘 */ }
  return memory[uid] || 0;
}
// 지금 보고 있다고 적어 둠
export function touch(uid, at = Date.now()) {
  memory[uid] = at;
  try { localStorage.setItem(key(uid), String(at)); } catch { /* 저장소 막힘 */ }
}

let current = null;
let busy = false;
let quietUntil = 0;

// 회원가입처럼 그 화면에서 직접 접속을 기록할 때: 잠깐 자동 기록을 멈춤
export function quiet(ms = 20000) { quietUntil = Date.now() + ms; }

// 쉬었다가 들어온 거면 접속 1건
async function check() {
  const st = current;
  if (!st || busy) return;
  if (Date.now() < quietUntil) { touch(st.uid); return; }
  const last = lastSeen(st.uid);
  touch(st.uid);
  if (Date.now() - last < GAP) return;
  busy = true;
  try {
    await be.recordLogin(st);
  } catch (e) {
    touch(st.uid, last);         // 실패하면 다음에 다시 시도
    console.warn('접속 기록 실패', e);
  } finally { busy = false; }
}

// 로그인한 학생이 페이지를 열었을 때 (quiet: 방금 직접 로그인해서 이미 기록한 경우)
export function startVisit(st, quiet) {
  if (!st || !st.active || !st.uid) { current = null; return; }
  current = st;
  if (quiet) touch(st.uid); else check();
}
export function stopVisit() { current = null; }

if (typeof document !== 'undefined') {
  // 창을 다시 볼 때(다른 탭·앱에 있다가 돌아옴) 확인
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  // 보고 있는 동안은 '같은 접속'으로 이어지게
  setInterval(() => { if (current && document.visibilityState === 'visible') touch(current.uid); }, BEAT);
}
