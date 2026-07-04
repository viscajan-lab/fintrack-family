FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
# Explicit no-cache, force fresh install setiap build
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
