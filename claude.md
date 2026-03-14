# 프로젝트
AI 기반 비디오/씬 관리용 Next.js(프론트) + Spring Boot(백엔드) 앱. `aivideo`.
기획서와 아키텍처는 `aivideo/setting`에 있음.

## 코드 스타일
- TypeScript strict (tsconfig), ES Modules, 경로별칭 `@/*`.
- React 함수 컴포넌트, Next.js App Router 패턴 유지.
- Tailwind 유틸리티 우선(커스텀 CSS 최소화).
- 타입 오류는 `next.config`가 무시 설정이지만 가능하면 해결.

## 명령어
- 프론트: `npm run dev -- --hostname 127.0.0.1 --port 3000` / `npm run lint` / `npm run build`.
- 백엔드(JDK 20 필수):  
  ```bash
  cd backend
  export JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk-20.jdk/Contents/Home"
  export PATH="$JAVA_HOME/bin:$PATH"
  export GRADLE_USER_HOME=$(pwd)/.gradle-home
  ./gradlew bootRun      # 서버
  ./gradlew test         # 테스트
  ```

## 주의 사항
- JDK 25로 실행 시 `Unsupported class file major version 69` 등 발생 → 반드시 JDK 20 사용.
- Next.js rewrites `/api/*` → `http://localhost:8080/api/*`; 백엔드가 함께 떠 있어야 함.
- `.next/dev/lock` 점유 시 기존 Next dev 프로세스 종료 후 재시작.
- lockfile 중복(`package-lock.json`, `pnpm-lock.yaml`)으로 Turbopack 루트 경고 가능.

## 검증 습관
- 변경 후 테스트/빌드/출력 확인: `./gradlew test`, `npm run lint` 등. UI는 가능하면 스크린샷 비교.

## 프롬프트 전략 (간결)
- 작업 범위·파일·시나리오·테스트 선호를 명시.
- 답을 찾을 소스를 지정(예: git 히스토리).
- 기존 패턴을 짚어 사용.
- 증상·위치·완료 기준을 명확히.
- 포함/제외: ✅ 추측 불가 명령·환경 변수·비표준 스타일·테스트 러너·저장소 에티켓·아키텍처·자주 놓치는 함정 / ❌ 코드만 읽어 알 수 있는 것·표준 규칙·자주 변하는 정보·장문의 튜토리얼.

## 백엔드 (8080)
```bash
cd /Users/hyunji/Desktop/aivideo/backend
export JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk-20.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
export GRADLE_USER_HOME=$(pwd)/.gradle-home
./gradlew bootRun
```

## 프론트 (3000)
```bash
cd /Users/hyunji/Desktop/aivideo
npm run dev -- --hostname 127.0.0.1 --port 3000
```
- `.next/dev/lock` 점유 시 해당 PID 종료 후 재시작.

## 자주 발생
- JDK 25로 실행 시 `Unsupported class file major version 69` → 반드시 JDK 20 사용.
- Turbopack가 루트 추론 경고를 낼 수 있음(중복 lockfile). 필요 시 불필요한 lockfile 제거.

추가 정보는 `README.md` 참고.
