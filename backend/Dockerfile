# syntax=docker/dockerfile:1.7
FROM python:3.11-slim

ARG APT_MIRROR=http://mirrors.aliyun.com
ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i \
        -e "s|http://deb.debian.org/debian|${APT_MIRROR}/debian|g" \
        -e "s|http://deb.debian.org/debian-security|${APT_MIRROR}/debian-security|g" \
        /etc/apt/sources.list.d/debian.sources; \
    fi; \
    printf 'Acquire::Retries "5";\nAcquire::http::Timeout "60";\nAcquire::https::Timeout "60";\n' > /etc/apt/apt.conf.d/80-retries; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
    bash ca-certificates curl default-jdk-headless git maven nodejs npm \
    php-cli php-curl php-mbstring php-xml unzip composer \
    ; \
    rm -rf /var/lib/apt/lists/*; \
    npm config set registry https://registry.npmmirror.com; \
    useradd --create-home --uid 10001 lightship; \
    mkdir -p /tmp/lightship-work; \
    chown -R lightship:lightship /tmp/lightship-work /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --retries 5 --timeout 60 \
    --index-url "${PIP_INDEX_URL}" -r requirements.txt

COPY app ./app

USER lightship

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
