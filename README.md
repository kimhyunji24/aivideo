# AI Video 실행 가이드

## 1차 데모본
![Image](https://github.com/user-attachments/assets/3fcead82-f2aa-4fde-86ce-c016b765df7f)

![Image](https://github.com/user-attachments/assets/c8b9941c-8256-4979-8f24-7f9ec04eb704)


## 요구사항
- Java 20 (권장: `JAVA_HOME=$(/usr/libexec/java_home -v 20)`)
- Node.js / npm

## 백엔드 실행 (포트 8080)
Spring Boot 3.2 + Gradle 8.14 환경에서 JDK 25로 실행하면 `ExceptionInInitializerError`(Lombok/JDK 충돌)가 발생할 수 있어 JDK 20으로 실행해야 합니다.

```bash
cd /Users/hyunji/Desktop/aivideo/backend

export JAVA_HOME=$(/usr/libexec/java_home -v 20)
export PATH="$JAVA_HOME/bin:$PATH"
export GRADLE_USER_HOME=$(pwd)/.gradle-home

# 선택: 실생성 모드 (미설정 시 mock-first 동작)
# export GOOGLE_API_KEY="YOUR_KEY"
# export GEMINI_TEXT_MODEL="gemini-1.5-pro"        # optional
# export GEMINI_IMAGE_MODEL="imagen-3.0-generate-002" # optional
# export GEMINI_VIDEO_MODEL="veo-3.0-generate-001" # optional
# export MOCK_MODE="true"                           # mock 응답 강제

./gradlew --stop
rm -rf build .gradle .gradle-home/caches .gradle-home/daemon
./gradlew clean bootRun --no-build-cache --refresh-dependencies
```

## 프론트 실행 (포트 3000)
```bash
cd /Users/hyunji/Desktop/aivideo
npm run dev -- --hostname 127.0.0.1 --port 3000
```

## 기획(Planning) 동작
1. 로그라인/장르&스타일/세계관을 정리하고 워크스페이스로 이동합니다.
2. 캐릭터 시트가 자동 시드됩니다. (캐릭터가 없어도 확정 가능)
3. `캐릭터 확정`을 누르면 플롯 섹션이 열립니다.
4. `3단계/4단계/5단계` 중 하나를 먼저 선택합니다.
5. `플롯 생성` 버튼을 눌러 선택한 단계 구조로 플롯을 생성합니다.
6. `플롯 재생성 지시사항` 입력값은 생성/재생성 API 요청에 반영됩니다.

## API 요약
- `POST /api/plot`: 아이디어 기반 플롯 3개 생성
- `POST /api/planning-seed`: 캐릭터 시트 + 단계별 플롯 시드 생성
  - 입력: `idea`, `logline`, `selectedGenres`, `selectedWorldviews`, `userPrompt`, `stageCount`
  - 동작: `mock-first` (키 없거나 실패 시 mock fallback, 키 있으면 Gemini 시도)

## 참고
- `next.config.mjs`에서 `/api/*`는 `http://localhost:8080/api/*`로 rewrite됩니다.
- Next.js가 다중 lockfile 때문에 워크스페이스 루트를 다르게 추론할 수 있습니다.

## 종료
- 각 실행 터미널에서 `Ctrl+C`
