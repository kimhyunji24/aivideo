[Unit]
Description=AI Video Backend (Spring Boot)
After=network.target redis-server.service
Wants=redis-server.service

[Service]
Type=simple
User={{APP_USER}}
WorkingDirectory={{APP_DIR}}/backend
EnvironmentFile=/etc/aivideo/aivideo.env
ExecStart=/bin/bash -lc 'exec /usr/bin/java $JAVA_OPTS -jar {{APP_DIR}}/backend/build/libs/aivideo-studio-0.0.1-SNAPSHOT.jar --server.port=${BACKEND_PORT}'
Restart=always
RestartSec=3
SuccessExitStatus=143
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
