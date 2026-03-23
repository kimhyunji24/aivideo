#!/bin/bash

# ~/.profile 또는 ~/.bashrc 소싱하여 pm2, node 명령어를 가져옴
if [ -f ~/.nvm/nvm.sh ]; then
    source ~/.nvm/nvm.sh
fi
export PATH=$PATH:/home/hyunji/.nvm/versions/node/v20.20.1/bin

cd /home/hyunji/aivideo

# 1. 최신 코드 동기화
git fetch origin main
git reset --hard origin/main
git pull origin main

# 2. 환경 변수 결정 (기존 실행 상태 확인)
if pm2 list | grep -q 'frontend-blue'; then
    IS_BLUE_ACTIVE=true
else
    IS_BLUE_ACTIVE=false
fi

if [ "$IS_BLUE_ACTIVE" = true ]; then
    TARGET_COLOR="green"
    TARGET_FRONTEND_PORT=3001
    TARGET_BACKEND_PORT=8081
    CURRENT_COLOR="blue"
else
    TARGET_COLOR="blue"
    TARGET_FRONTEND_PORT=3000
    TARGET_BACKEND_PORT=8080
    CURRENT_COLOR="green"
fi

echo "======================================"
echo "🎯 Deploying to $TARGET_COLOR environment..."
echo "======================================"

# 3. 백엔드 빌드
echo "🚀 Building Backend..."
cd backend
# VM 환경에 맞는 인증 경로 강제 주입
sed -i 's|application-credentials: .*|application-credentials: "/home/hyunji/.config/gcloud/application_default_credentials.json"|g' src/main/resources/application-prod.yml
chmod +x gradlew
./gradlew bootJar
cd ..

# 4. 프런트엔드 빌드
echo "🚀 Building Frontend..."
npm install
npm run build

# 5. Target 환경 실행
echo "🚀 Starting $TARGET_COLOR environment applications..."
pm2 start "java -jar backend/build/libs/aivideo-studio-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod --server.port=$TARGET_BACKEND_PORT" --name "backend-$TARGET_COLOR"

pm2 start "npm start -- -p $TARGET_FRONTEND_PORT" --name "frontend-$TARGET_COLOR" --update-env --env BACKEND_URL="http://localhost:$TARGET_BACKEND_PORT"

# 6. Health Check
echo "⏳ Waiting 30 seconds for applications to initialize..."
sleep 30

# 7. Nginx 스위칭
echo "🔄 Switching Nginx to point to $TARGET_COLOR port ($TARGET_FRONTEND_PORT)..."
echo "
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:$TARGET_FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
" | sudo tee /etc/nginx/sites-available/aivideo > /dev/null

sudo ln -sf /etc/nginx/sites-available/aivideo /etc/nginx/sites-enabled/
# 기본 default 사이트가 있다면 삭제
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t && sudo nginx -s reload

# 8. 기존 프로세스 종료
echo "🗑️ Stopping old $CURRENT_COLOR environment processes..."
if [ "$IS_BLUE_ACTIVE" = true ]; then
    pm2 delete frontend-blue || true
    pm2 delete backend-blue || true
else
    # 최초 실행 시에는 기존 green 프로세스가 없으므로 오류 무시
    pm2 delete frontend-green || true
    pm2 delete backend-green || true
fi

pm2 save
echo "✅ Deployment to $TARGET_COLOR successful!"
