FROM node:18-alpine AS builder
WORKDIR /app
COPY . ./
RUN npm install && npm run build

FROM docker.io/joseluisq/static-web-server:2.39.0
COPY --from=builder /app/build /content/
USER 3000
ENV SERVER_LOG_LEVEL=info
ENTRYPOINT ["/static-web-server", "--port=8080", "--root=/content"]
