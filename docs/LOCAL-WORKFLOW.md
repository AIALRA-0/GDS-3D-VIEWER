# Original local API workflow

The original Python-backed engineering workflow is separate from the static public viewer. Its API has no tenant authentication and must remain on localhost or a protected network.

## Backend

From the repository root using Python 3.11 or a compatible environment:

```sh
# Create and activate an isolated Python environment on POSIX
python3 -m venv .venv
source .venv/bin/activate
# Install API and test dependencies
python -m pip install -r apps/api/requirements.txt
# Start the local API from its application directory
cd apps/api
uvicorn app.main:app --reload --host 127.0.0.1 --port 34000
```

Windows PowerShell activation uses `.\.venv\Scripts\Activate.ps1`.

## Frontend

In another terminal at the repository root:

```sh
# Install the locked frontend dependencies
npm ci
# Start the original local API frontend
npm run dev:web -- --mode legacy --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/legacy.html` and use `fixtures/example/example.gds`. Optional manifest, metrics, markers, DEF and LEF inputs, backend explanations, commands, comparisons and session exports follow [the compatibility contract](COMPATIBILITY_SPEC.md).

Without a backend model key, the existing explanation service uses deterministic local rules. Optional backend credentials belong in local environment variables, never public browser builds. This differs from the public viewer's ephemeral browser-key harness.

## Verification and deployment

```sh
# Run backend regressions from the root
python -m pytest apps/api/tests -q
# Build the separate original entry
npm run build:legacy
# With both local services running, execute the existing browser smoke
npm run test:e2e
```

Never deploy `dist-local`, legacy viewer files or the Python API through the public static host. Historical [backend deployment templates](DEPLOYMENT.md) describe a different setup; public deployment follows [PUBLIC-PREVIEW.md](PUBLIC-PREVIEW.md).
