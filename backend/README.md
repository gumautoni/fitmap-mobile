# FitMap Backend

Backend API for the FitMap mobile fitness platform.

## Requirements

- Python 3.13
- uv

## Setup

From the `backend` directory:

```bash
uv sync
```

The project virtual environment is managed locally in `.venv/` and must not be committed.

## Environment configuration

Copy the example configuration when local overrides are needed.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Supported baseline variables:

```text
FITMAP_ENVIRONMENT=development
FITMAP_LOG_LEVEL=INFO
```

Local `.env` files are ignored by Git and must not contain production credentials.

## Run

Start the development API:

```bash
uv run uvicorn fitmap.main:app --host 127.0.0.1 --port 8000 --reload
```

API documentation is available at:

```text
http://127.0.0.1:8000/docs
```

## System endpoints

```text
GET /health
GET /ready
```

`/health` confirms that the API process is running.

`/ready` currently confirms that the application initialized successfully. Dependency readiness checks will be introduced when infrastructure such as PostgreSQL is added.

## Quality checks

```bash
uv run ruff check src
uv run ruff format --check src
uv run pyright src
uv lock --check
```

To automatically format source files:

```bash
uv run ruff format src
```

## Architecture

The backend follows the FitMap modular-monolith architecture with four primary business modules:

- Identity
- Gyms
- Training
- Progress

Product-specific persistence, authentication and business capabilities are implemented through their respective backlog items rather than being bundled into the backend foundation.
