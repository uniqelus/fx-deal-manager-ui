FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY . /usr/share/nginx/html/
RUN rm -f \
    /usr/share/nginx/html/Dockerfile \
    /usr/share/nginx/html/default.conf.template \
    /usr/share/nginx/html/docker-compose.yml \
    /usr/share/nginx/html/.dockerignore \
 && find /usr/share/nginx/html -type d -exec chmod 0755 {} \; \
 && find /usr/share/nginx/html -type f -exec chmod 0644 {} \;

ENV API_UPSTREAM=api:8000

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
