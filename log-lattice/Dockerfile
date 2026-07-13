FROM python:3.12-alpine

WORKDIR /app
COPY server.py /app/server.py

ENV THESEUS_LOG_DB=/data/events.sqlite
EXPOSE 8768

CMD ["python", "/app/server.py"]

