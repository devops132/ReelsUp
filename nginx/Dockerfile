
FROM nginx:1.25-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY ssl.conf /etc/nginx/conf.d/ssl.conf
RUN mkdir -p /var/www/certbot
RUN printf '#!/bin/sh\nset -e\nCERT="/etc/letsencrypt/live/default/fullchain.pem"\nif [ ! -f "$CERT" ]; then\n  echo "SSL cert not found, disabling ssl.conf"\n  rm -f /etc/nginx/conf.d/ssl.conf || true\nelse\n  echo "SSL cert found, keeping ssl.conf"\nfi\n' > /docker-entrypoint.d/40-disable-ssl-if-missing.sh && chmod +x /docker-entrypoint.d/40-disable-ssl-if-missing.sh
