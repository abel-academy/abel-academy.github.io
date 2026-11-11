// 학습 보조 게임 목록 (새 파일로 따로 두어, 브라우저에 예전 common.js가 남아 있어도 화면이 깨지지 않게 함)
// 학원 홈페이지 안에 만든 게임 (선생님 화면 → 학습 보조에서 학생에게 등록)
export const LEARN_BUILTINS = [
  { id: 'cube-net', title: '정육면체 전개도 연습', desc: '혼자 단계별로 연습해요: 접히는 전개도 찾기, 마주 보는 면, 주사위 눈 채우기, 전개도 완성하기. 직접 접어 볼 수도 있어요.', page: 'game-cube-net.html', grades: ['초4', '초5', '초6'], stages: 4 },
  { id: 'proposition', title: '명제 탐정', desc: '혼자 단계별로 연습해요: 반례 사냥, 부정 거울, 역·대우 카드, 필요·충분 수직선, 최솟값 찾기(절대부등식), 보너스 참말족·거짓말족 퍼즐. 문제는 풀 때마다 새로 만들어져요.', page: 'game-proposition.html', grades: ['고1'], stages: 6, icon: 'search' }
];
export const LEARN_MAX = 30;
