# AI Video 실행 가이드

## 요구사항
- Java 20 이상 (기본 JDK 25로 실행 시 `Unsupported class file major version 69` 오류 발생 → JDK 20으로 실행)
- Node.js / npm

## 백엔드 실행 (포트 8080)
Spring Boot 3.2 + Gradle 8.14 조합에서 기본 JDK 25로 실행하면 `Unsupported class file major version 69` 또는 `ExceptionInInitializerError`가 날 수 있습니다. JDK 20을 사용하도록 아래처럼 환경변수를 잡아주세요.
```bash
cd backend
# 세션에 한 번만 실행
export JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk-20.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
export GRADLE_USER_HOME=$(pwd)/.gradle-home

# 혹시 이전에 잘못된 JDK로 뜬 Gradle 데몬이 있으면 종료
./gradlew --stop

# 서버 실행                                                                    
  cd /Users/hyunji/Desktop/aivideo/backend                                                                
  export JAVA_HOME="/Library/Java/JavaVirtualMachines/jdk-20.jdk/Contents/Home"                           
  export PATH="$JAVA_HOME/bin:$PATH"                                                                      
  export GRADLE_USER_HOME=$(pwd)/.gradle-home                                                             
  export ANTHROPIC_API_KEY="[ENCRYPTION_KEY]"   # ← API 키 입력                                          
  ./gradlew bootRun           
```

## 프론트 실행 (포트 3000)
```bash
cd /Users/hyunji/Desktop/aivideo
npm run dev -- --hostname 127.0.0.1 --port 3000
```
- 다른 Next.js dev 프로세스가 `.next/dev/lock`을 잡고 있으면 종료 후 재시작 (`lsof <프로젝트경로>/.next/dev/lock` → `kill <PID>`).

## 종료
- 각 실행 터미널에서 `Ctrl+C`, 또는 백그라운드로 띄운 경우 `kill <PID>`.

## 참고
- 현재 실행 중: 백엔드 PID 95171 (http://127.0.0.1:8080), 프론트 PID 98818 (http://127.0.0.1:3000).
- Next.js가 다중 lockfile 때문에 워크스페이스 루트를 `/Users/hyunji`로 추론하여 경고가 뜰 수 있음. 필요 시 불필요한 lockfile을 제거하거나 `next.config.mjs`에 `turbopack.root`를 명시하세요.
