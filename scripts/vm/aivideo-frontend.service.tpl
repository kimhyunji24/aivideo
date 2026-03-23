[Unit]
Description=AI Video Frontend (Next.js)
After=network.target aivideo-backend.service
Wants=aivideo-backend.service

[Service]
Type=simple
User={{APP_USER}}
WorkingDirectory={{APP_DIR}}
EnvironmentFile=/etc/aivideo/aivideo.env
ExecStart=/bin/bash -lc 'exec /usr/bin/npm start -- --port ${FRONTEND_PORT}'
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
