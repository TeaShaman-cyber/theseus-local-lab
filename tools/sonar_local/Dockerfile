FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    THESEUS_SONAR_DB=/var/lib/sonar/sonar.duckdb \
    THESEUS_SONAR_OUT=/var/lib/sonar/output \
    AUTOMEM_API_URL=http://host.docker.internal:8001

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY federation_contract.json sonar_local.py sonar_mcp.py mcp_smoke.py mcp_http_smoke.py test_sonar_local.py test_sonar_http.mjs README.md ./

VOLUME ["/var/lib/sonar"]

CMD ["python", "sonar_mcp.py"]
