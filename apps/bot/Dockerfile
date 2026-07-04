FROM python:3.11-slim

WORKDIR /app

# Force cache invalidation — bump this when deps change
ARG CACHEBUST=2

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
