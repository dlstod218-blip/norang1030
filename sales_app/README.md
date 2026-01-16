<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 매출분석 마스터 (PWA + 배포용 보안 프록시)

이 프로젝트는 **PWA(설치형 웹앱)** + **Gemini API 서버 프록시(/api/gemini)** 구조입니다.

✅ 핵심: **GEMINI_API_KEY는 서버(배포 환경변수)에만 저장**하고, 프론트에서는 `/api/gemini`로 호출합니다.

## 로컬 실행

**Prerequisites:** Node.js

1) 패키지 설치

```bash
npm install
```

2) 환경변수 설정

`.env.example`를 참고해 `.env`를 만들거나, 터미널에서 환경변수를 설정하세요.

```bash
# 예: macOS/Linux
export GEMINI_API_KEY="YOUR_KEY"
```

3) Vercel 스타일로 로컬에서 API까지 함께 테스트(권장)

Vercel Functions(`/api`)를 로컬에서 같이 돌리려면 Vercel CLI가 가장 편합니다.

```bash
npm i -g vercel
vercel dev
```

브라우저에서 안내되는 URL로 접속하면, 프론트와 `/api/gemini`가 함께 동작합니다.

## 배포 (Vercel 추천)

1) Vercel에 GitHub 레포 연결 후 Deploy
2) Vercel 프로젝트 설정에서 Environment Variables에 아래를 추가

- `GEMINI_API_KEY` (필수)
- `ALLOWED_ORIGINS` (권장, 예: https://yourdomain.com)
- `GEMINI_MODEL_DEFAULT` (선택)

### 사내 전용 접근 제어 (개인 계정 배포용)

팀/조직 없이 개인 계정으로 배포할 때는, **공유 비밀번호(사내 전용)** 방식이 가장 간단합니다.

- `INTERNAL_APP_PASSWORD` (권장): 사내에서만 공유하는 비밀번호

배포 환경에 `INTERNAL_APP_PASSWORD`를 설정하면, 앱 내 "사내 전용 비밀번호" 입력란에 비밀번호를 입력해야 AI 기능이 동작합니다.
비밀번호는 브라우저 `sessionStorage`에만 저장되어, 새 브라우저/새 세션에서는 다시 입력이 필요합니다.

배포 후 앱에서 AI 기능이 정상 동작하면 완료입니다.
