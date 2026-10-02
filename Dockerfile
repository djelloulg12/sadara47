FROM python:3.12-slim
WORKDIR /app
COPY . .
ENV PYTHONUNBUFFERED=1
EXPOSE 4173
CMD ["sh", "-c", "python - <<'PY'\nimport os\np='server.py'\ns=open(p).read().replace("('127.0.0.1',4173)", "('0.0.0.0', int(os.environ.get('PORT','4173')))")\nopen('/tmp/server_runtime.py','w').write(s)\nPY\npython /tmp/server_runtime.py"]

