FROM node:22-bookworm-slim AS build

ENV APP_BASE_PATH=/rushhour/
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN addgroup --system rushhour && adduser --system --ingroup rushhour rushhour
COPY --chown=rushhour:rushhour src/ src/
COPY --from=build --chown=rushhour:rushhour /app/src/frontend/dist/ src/frontend/dist/
USER rushhour
EXPOSE 8000

CMD ["python3", "-m", "src.server.app", "--host", "0.0.0.0", "--port", "8000"]
