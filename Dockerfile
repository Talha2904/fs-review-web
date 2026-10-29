# FS Review web app image: the Vite build served by nginx, which also passes /api to the api container.
# Build:  docker build -t fs-review-web .   The api is expected at http://api:8787 (see nginx.conf).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# nginx as a non-root user, listening on 8080
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
