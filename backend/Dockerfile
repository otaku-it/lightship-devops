FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ca-certificates curl default-jdk-headless git maven nodejs npm \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 lightship \
    && mkdir -p /tmp/lightship-work \
    && chown -R lightship:lightship /tmp/lightship-work /app

COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .

USER lightship

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
