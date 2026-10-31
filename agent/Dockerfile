FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-fetch VAD model files at build time so the container doesn't need
# network access to them on first run.
RUN python agent.py download-files

CMD ["python", "agent.py", "start"]
