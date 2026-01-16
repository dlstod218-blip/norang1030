# Vercel 환경변수

Vercel > Project > Settings > Environment Variables 에 아래 값을 추가하세요.

필수:
- GEMINI_API_KEY : Gemini API Key
- INTERNAL_APP_PASSWORD : 사내 공유 비밀번호 (AI 기능 보호용)

권장:
- ALLOWED_ORIGINS : 허용할 도메인 (콤마로 여러개 가능)
  - 예) https://your-project.vercel.app,https://your-custom-domain.com

선택:
- GEMINI_MODEL_DEFAULT : 기본 모델명 (기본: gemini-1.5-flash)
