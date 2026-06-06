---
trigger: always_on
---

# General Python (FastAPI) Development principles

- **Type Hints**: Annotate every function signature and class attribute. **Never use bare `Any`** — use a concrete type, `object`, a `TypeVar`, or a `Protocol`. Run a type checker in strict mode
- **Safe Access**: Prefer `dict.get(key)` over `dict[key]` for optional lookups; model optional fields explicitly as `T | None` and guard `None` before attribute access
- **Imports**: Grouped stdlib → third-party → first-party (`app.*`), alphabetized within each group — enforced and auto-fixed by ruff (`I` rules), never hand-sorted
- **Endpoints**: `async def` path operations with explicit Pydantic request/response models; never return a raw `dict` from a public endpoint
- **Naming**: snake_case for variables/functions/modules, PascalCase for classes (models, enums, exceptions), UPPER_SNAKE_CASE for constants
- **Error Handling**: Raise `HTTPException` (or a custom exception mapped by a handler) for client-facing failures; wrap external I/O in `try/except` with specific exception types — never bare `except:`
- **Dependency Management**: Use FastAPI dependency injection (`Depends`) for shared resources (DB session, current user, settings); minimize parameter drilling
- **File Structure**: Feature-based packages (`app/<feature>/`), not layer-only dumping grounds
- **Formatting**: ruff format enforced, 4-space indentation
- **Composition**: Compose behavior with `APIRouter`, dependencies, and small service functions rather than deep inheritance
