FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# Install Python dependencies
COPY pyproject.toml ./
RUN mkdir -p app && touch app/__init__.py && \
    uv pip install --system --no-cache . && \
    rm -rf app

# Copy application code
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini ./
RUN uv pip install --system --no-cache .

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
