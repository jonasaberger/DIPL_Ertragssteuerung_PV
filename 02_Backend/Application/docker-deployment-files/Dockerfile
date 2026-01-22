FROM python:3.11-slim

WORKDIR /app

# ---- system deps for RPi.GPIO build ----
RUN apt-get update && apt-get install -y \
    gcc \
    libc6-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY ../requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY .. .

EXPOSE 5050

# For production with Gunicorn
CMD ["gunicorn", "-w", "1", "--threads", "4", "--worker-class", "gthread", "--bind", "0.0.0.0:5050", "app:app"]



