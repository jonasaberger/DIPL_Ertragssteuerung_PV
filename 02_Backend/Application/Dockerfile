FROM python:3.11-slim

WORKDIR /app

# ---- system deps for RPi.GPIO build ----
RUN apt-get update && apt-get install -y \
    gcc \
    libc6-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5050
CMD ["python", "main.py"]


