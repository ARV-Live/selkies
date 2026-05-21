FROM ghcr.io/linuxserver/baseimage-alpine:3.22

# Build frontend core along with dashboard

ARG SELKIES_MODE
ARG SELKIES_UPLOAD_DIR

RUN apk add \
    cmake \
    git \
    nodejs \
    npm

WORKDIR /tmp

COPY ./selkies-web-core /tmp/selkies-web-core
COPY ./selkies-dashboard /tmp/selkies-dashboard
COPY ./universal-touch-gamepad /tmp/universal-touch-gamepad

RUN \
  cd ./selkies-web-core && \
  npm install && \
  npm run build && \
  DASHBOARDS="selkies-dashboard" && \
  mkdir /buildout && \
  cd /tmp/selkies-dashboard && \
  cp ../selkies-web-core/dist/selkies-core.js src/ && \
  npm install && \
  export SELKIES_INJECT=1 && \
  export SELKIES_MODE="${SELKIES_MODE:-webrtc}" &&\
  export SELKIES_UPLOAD_DIR="${SELKIES_UPLOAD_DIR:-/home/ubuntu/Desktop}" &&\
  npm run build && \
  mkdir -p dist/src dist/nginx dist/assets && \
  cp ../selkies-web-core/dist/selkies-core.js dist/src/ && \
  cp ../selkies-web-core/dist/clipboard-worker* dist/assets && \
  cp ../universal-touch-gamepad/universalTouchGamepad.js dist/src/ && \
  cp ../selkies-web-core/nginx/* dist/nginx/ && \
  cp -r ../selkies-web-core/dist/jsdb dist/ && \
  mkdir -p /usr/share/nginx/html && \
  cp -ar dist/* /usr/share/nginx/html/;

# Create goIRL-branded manifest.json (overrides any manifest copied from the
# dashboard so the installable web-app metadata matches the customer brand).
RUN cat <<EOF > /usr/share/nginx/html/manifest.json
{
  "name": "goIRL",
  "short_name": "goIRL",
  "manifest_version": 2,
  "version": "1.0.0",
  "display": "fullscreen",
  "background_color": "#0e0f12",
  "theme_color": "#11adc9",
  "icons": [
    {
      "src": "icon.png",
      "type": "image/png",
      "sizes": "300x300"
    }
  ],
  "start_url": "/"
}
EOF

# Icons ship as part of the dashboard's `public/` folder (favicon.ico,
# icon.png) and are already in /usr/share/nginx/html from the dist copy
# above. We intentionally do NOT overwrite them with the linuxserver
# selkies-logo here — that would clobber the goIRL branding.
