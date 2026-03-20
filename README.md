# AI Video 실행 가이드

## 1차 데모본
![Image](https://github.com/user-attachments/assets/3fcead82-f2aa-4fde-86ce-c016b765df7f)

![Image](https://github.com/user-attachments/assets/86f5ac70-0c9b-46e6-aa23-a0efae6bfc26)


## 요구사항
- Node.js / npm
- Redis (세션 관리를 위해 백엔드에서 필수 사용)
  - Mac OS 설치 및 실행: `brew install redis` && `brew services start redis`
- (백엔드의 경우 Toolchain을 통해 호환되는 Java 17을 자동으로 잡아주므로 별도 설치/환경 설정이 필요하지 않습니다)

## 백엔드 실행 (포트 8080)

1. **Redis 실행 상태 확인**
   - 백엔드는 세션을 Redis에 저장하므로, 먼저 Redis 서버가 켜져 있어야 합니다.
   - 처음 한번 켜두었다면 백그라운드에서 동작합니다. (`brew services start redis`)

2. **서버 실행**
   - 클라우드 API (Gemini, Imagen, Veo 등) 속성들이 정의된 `application-local.yml`을 적용하기 위해 반드시 `local` 프로파일로 실행해야 합니다.

```bash
cd /Users/hyunji/Desktop/aivideo/backend

# local 프로파일 적용 및 실행
SPRING_PROFILES_ACTIVE=local ./gradlew clean bootRun
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
