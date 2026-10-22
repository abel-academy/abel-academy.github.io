/* ──────────────────────────────────────────────────────────────
   Firebase 연결 정보
   Firebase 콘솔 → 프로젝트 설정(톱니바퀴) → '내 앱'의 웹 앱 →
   'SDK 설정 및 구성'에 나오는 firebaseConfig 값을 그대로 붙여 넣으세요.
   이 값들은 홈페이지에 공개되어도 괜찮은 값이에요.
   실제 보안은 Firebase에 붙여 넣는 firestore.rules(보안 규칙)가 지킵니다.
   ────────────────────────────────────────────────────────────── */
export const firebaseConfig = {
  apiKey: "AIzaSyAGspyFAGFJJTciH0q_mVKiSzABmnx9U_I",
  authDomain: "abel-academy.firebaseapp.com",
  projectId: "abel-academy",
  storageBucket: "abel-academy.firebasestorage.app",
  messagingSenderId: "417901924633",
  appId: "1:417901924633:web:9be8c3df5e15ce08363588"
};

/* 학생 아이디는 로그인할 때 "아이디@아래주소" 형태로 바뀌어 저장돼요.
   (학생에게 이메일이 없어도 되도록 하는 장치이고, 이 주소로 메일이 가지는 않아요)
   한 번 학생 계정을 만든 뒤에는 바꾸지 마세요. 바꾸면 기존 학생이 로그인할 수 없어요. */
export const STUDENT_EMAIL_DOMAIN = "students.example.com";
