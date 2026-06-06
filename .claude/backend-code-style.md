# Backend FastAPI (Python) Code Style Guidelines

> Sibling document to [frontend-code-style.md](./frontend-code-style.md). Same philosophy — strong typing, single source of truth, explicit structure, testability — expressed in this backend's stack: **FastAPI**, **SQLModel**, **Pydantic v2**, **psycopg 3** (PostgreSQL), **ruff**, **pytest**.

## General Principles

- **Type Hints**: Annotate every function signature and class attribute. **Never use bare `Any`** — use a concrete type, `object`, a `TypeVar`, or a `Protocol`. Run a type checker (mypy/pyright) in strict mode.
- **Safe Access**: Prefer `dict.get(key)` over `dict[key]` for optional lookups, model `Optional` fields explicitly as `T | None`, and guard `None` before attribute access. This is the Python analogue of the frontend's mandatory optional chaining.
- **Imports**: Grouped stdlib → third-party → first-party (`app.*`), alphabetized within each group. Let **ruff** (`I` rules) enforce and auto-fix this — never hand-sort.
- **Endpoints**: `async def` path operations with explicit Pydantic request/response models. Never return a raw `dict` from a public endpoint — type it with a `response_model`.
- **Naming**: `snake_case` for functions/variables/modules, `PascalCase` for classes (models, enums, exceptions), `UPPER_SNAKE_CASE` for module-level constants.
- **Error Handling**: Raise `HTTPException` (or a custom exception mapped by an exception handler) for client-facing failures. Wrap external I/O in `try/except` with specific exception types — never bare `except:`.
- **Dependency Management**: Use FastAPI dependency injection (`Depends`) for shared resources (DB session, current user, settings). This is the backend equivalent of React Context — it kills "parameter drilling".
- **File Structure**: Feature-based packages (`app/<feature>/`), not layer-only dumping grounds.
- **Formatting**: **ruff format** enforced, 4-space indentation. Do not hand-format.
- **Composition**: Compose behavior with `APIRouter`, dependencies, and small service functions rather than deep inheritance.

## Development Best Practices

### Use Enums

**Never declare a field as a literal-string union** (e.g. `status: Literal["active", "canceled"]`). Define an `Enum` (prefer `StrEnum` so the value serializes as its string) in a shared `constants.py` and reference it on the field. Applies to status fields, type-tag/discriminator fields, billing-cycle/interval fields — anything where the set of valid values is closed and finite.

```python
# ❌ Avoid — literal-string union inline on the field
from typing import Literal
from pydantic import BaseModel

class Subscription(BaseModel):
    status: Literal["active", "trialing", "canceled", "past_due"]
    billing_cycle: Literal["monthly", "yearly"]

# ✅ Prefer — StrEnum referenced from a shared constants module
# app/subscriptions/constants.py
from enum import StrEnum

class SubscriptionStatus(StrEnum):
    ACTIVE = "active"
    TRIALING = "trialing"
    CANCELED = "canceled"
    PAST_DUE = "past_due"

class BillingCycle(StrEnum):
    MONTHLY = "monthly"
    YEARLY = "yearly"

# app/subscriptions/models.py
from pydantic import BaseModel
from app.subscriptions.constants import BillingCycle, SubscriptionStatus

class Subscription(BaseModel):
    status: SubscriptionStatus
    billing_cycle: BillingCycle
```

**Why this matters**:

- **Single source of truth** — the valid values are defined once. Adding `SubscriptionStatus.PAUSED` is one edit, not a grep-and-replace across every `Literal` site.
- **Refactor safety** — renaming a value updates every consumer.
- **Call-site clarity** — `SubscriptionStatus.ACTIVE` reads as a named concept; `"active"` is a magic string scattered across the codebase.
- **Exhaustiveness** — `match` statements and type checkers can verify all enum members are handled.
- **Free OpenAPI schema** — FastAPI renders the enum as a proper `enum` in `/docs`, and DB columns can reference the same type.

**Placement**: shared enums live in the most-upstream module that owns the concept — typically `app/<feature>/constants.py`. SQLModel table models, Pydantic schemas, and service code all import from there.

### Concurrent I/O Instead of Sequential Awaits

Don't `await` independent coroutines one at a time in a loop. Gather them so I/O overlaps — the backend analogue of the frontend's `batchProcess`.

```python
import asyncio

# ❌ Avoid — serial; total latency is the sum of every call
results = []
for sub_id in subscription_ids:
    results.append(await fetch_subscription(sub_id))

# ✅ Prefer — concurrent; total latency is the slowest single call
results = await asyncio.gather(*(fetch_subscription(s) for s in subscription_ids))
```

For large fan-outs, bound concurrency with a `Semaphore` so you don't exhaust the DB connection pool or hit external rate limits:

```python
semaphore = asyncio.Semaphore(10)

async def fetch_bounded(sub_id: int) -> Subscription:
    async with semaphore:
        result = await fetch_subscription(sub_id)
        return result

results = await asyncio.gather(*(fetch_bounded(s) for s in subscription_ids))
```

### HTTP Client

Use a shared `httpx.AsyncClient` for outbound calls — **never** the blocking `requests` library inside `async` code (it blocks the event loop), and never create a new client per request. Construct one client at startup via the lifespan handler and inject it as a dependency, so connection pooling, timeouts, and tracing are configured once.

```python
# Avoid — blocks the event loop, no pooling
import requests
resp = requests.get(url)

# Prefer — shared async client, injected
async def get_http_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http_client
```

### Don't Block the Event Loop

In an `async def` route, never call blocking code directly (sync DB drivers, `time.sleep`, heavy CPU work, `requests`). Either use the async equivalent or offload with `await asyncio.to_thread(...)` / `run_in_executor`. A single blocking call stalls every concurrent request on the worker — the backend's most common and most invisible performance bug. (Mirrors the frontend rule against expensive synchronous work on the render path.)

### Function Parameters

When a function takes more than ~3 related parameters, group them into a Pydantic model or a dataclass instead of a long positional signature — the backend analogue of the frontend's object-parameter rule. Otherwise, make non-trivial parameters keyword-only with `*` so call sites stay self-documenting.

```python
# ❌ Avoid — positional soup; easy to transpose arguments
def create_subscription(name, price, currency, cycle, trial_days, user_id): ...

# ✅ Prefer — a validated input model
class CreateSubscriptionInput(BaseModel):
    name: str
    price: Decimal
    currency: str
    cycle: BillingCycle
    trial_days: int = 0

def create_subscription(*, user_id: int, data: CreateSubscriptionInput) -> Subscription: ...
```

### Avoid Re-export `__init__.py` Files

Import symbols directly from the module that defines them (`from app.subscriptions.service import create_subscription`) rather than funneling everything through a catch-all `__init__.py`. Keep `__init__.py` files empty (or absent where namespace packages allow). This mirrors the frontend's "no `index.tsx` barrel files" rule — barrels obscure where a symbol actually lives, create import cycles, and slow startup.

### Feature Package Structure

Wrap each feature in a package so its router, schemas, models, service logic, and constants live together. Use `snake_case` for module and package names:

```text
app/
  main.py                     # FastAPI app, middleware, router registration only
  core/
    config.py                 # Settings (pydantic-settings)
    database.py               # engine, get_session dependency
  subscriptions/
    router.py                 # APIRouter — thin HTTP layer
    service.py                # business logic, no FastAPI imports
    models.py                 # SQLModel table models
    schemas.py                # Pydantic request/response models
    constants.py              # enums, default values, magic numbers
    dependencies.py           # feature-scoped Depends providers
  insights/
    router.py
    service.py
    ...
```

**Why this matters**: This makes dependencies explicit and keeps the HTTP layer thin. `router.py` parses/validates and delegates; `service.py` holds logic and is unit-testable without spinning up the app. A flat `app/` of `routes.py`, `models.py`, `utils.py` makes every feature appear tangled with every other — the backend version of the frontend's "child components belong in a `components/` subfolder" reasoning.

**Apply this pattern to all new work going forward.**

### Keep Routers Thin, Logic in Services

Path operation functions should validate input, call a service function, and shape the response — nothing more. Business logic, DB queries, and external calls live in `service.py`, which imports no FastAPI symbols. This keeps logic testable in isolation and reusable across endpoints, background tasks, and CLI scripts. (Analogous to the frontend rule of keeping logic out of JSX via named handlers.)

```python
# router.py — thin
@router.post("/subscriptions", response_model=SubscriptionPublic, status_code=201)
async def create_subscription_endpoint(
    data: SubscriptionCreate,
    session: SessionDep,
    user: CurrentUser,
) -> Subscription:
    subscription = await subscriptions_service.create(session, user_id=user.id, data=data)
    return subscription

# service.py — logic, no FastAPI imports
async def create(session: AsyncSession, *, user_id: int, data: SubscriptionCreate) -> Subscription:
    ...
```

### Utility Module Structure

Give each non-trivial utility its own module with a colocated (or mirrored) test, rather than a grab-bag `utils.py`. Use `snake_case`:

```text
app/core/utils/
  format_currency.py
  proration.py
tests/core/utils/
  test_format_currency.py
  test_proration.py
```

**Why this matters**: isolated modules make it obvious what each test covers and keep unit tests focused — the same reasoning as the frontend's per-utility folder rule.

### Extract Constants for Testing

**Proactively extract magic numbers, default values, and config objects** into `constants.py` so implementation and tests reference the same source of truth.

```python
# app/subscriptions/constants.py
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
DEFAULT_TRIAL_DAYS = 14

# app/subscriptions/router.py
from app.subscriptions.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

@router.get("/subscriptions", response_model=list[SubscriptionPublic])
async def list_subscriptions(
    session: SessionDep,
    limit: int = Query(default=DEFAULT_PAGE_SIZE, le=MAX_PAGE_SIZE),
    offset: int = 0,
) -> list[Subscription]: ...

# tests/subscriptions/test_router.py
from app.subscriptions.constants import DEFAULT_PAGE_SIZE

def test_list_uses_default_page_size(client): ...  # tests stay in sync automatically
```

**When to extract**: default query params (page size, sort), configuration objects, magic numbers/strings used in logic, any value a test needs to assert against.

### Async/Await

Prefer `async def` endpoints and async drivers throughout the request path. Use `await` directly; **don't wrap a single awaitable in `asyncio.gather`** unless you genuinely have multiple to run concurrently. If a route must touch a sync-only library, isolate it behind `asyncio.to_thread`.

## FastAPI Patterns

### Dependency Injection Over Parameter Drilling

**Proactively use `Depends`** so shared resources are provided where they're needed instead of threaded through every function. This is the direct backend analogue of the frontend's Context-provider rule.

**When to use a dependency**:

- ✅ Resources needed by many endpoints (DB session, settings, HTTP client)
- ✅ Cross-cutting concerns (authentication / current user, pagination params, request-scoped context)
- ✅ Anything requiring setup/teardown (use a `yield` dependency)

**When NOT to**:

- ❌ A one-off value used by a single endpoint (just compute it inline)
- ❌ Pure functions with no shared state (import and call them)

Alias common dependencies with `Annotated` so signatures stay short and consistent:

```python
# app/core/database.py
from typing import Annotated
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSession(engine) as session:
        yield session

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# app/auth/dependencies.py
CurrentUser = Annotated[User, Depends(get_current_user)]

# usage — clean, no drilling
@router.get("/subscriptions")
async def list_subscriptions(session: SessionDep, user: CurrentUser) -> list[Subscription]: ...
```

A `yield` dependency can raise `HTTPException` in its teardown to map a domain error to an HTTP response — use it for transaction rollback and resource cleanup.

### Cache Settings and Expensive Singletons

Build settings and other expensive read-only singletons **once** with `functools.lru_cache`, then inject the cached instance. This is the backend equivalent of the frontend's "memoize context values" rule — without it, every request reconstructs the object (and re-reads the environment).

```python
# app/core/config.py
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
    database_url: str
    cors_origins: list[str] = ["http://localhost:3000"]

@lru_cache
def get_settings() -> Settings:
    return Settings()

# usage
SettingsDep = Annotated[Settings, Depends(get_settings)]
```

### Separate Request and Response Schemas

Define distinct Pydantic/SQLModel classes per use case — never accept or return the raw table model. A shared base + thin subclasses keeps them DRY (the SQLModel idiom), and prevents leaking secrets or letting clients write server-controlled fields.

```python
class SubscriptionBase(SQLModel):
    name: str
    price: Decimal
    billing_cycle: BillingCycle

class Subscription(SubscriptionBase, table=True):       # DB table — never exposed directly
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")          # server-controlled

class SubscriptionCreate(SubscriptionBase):              # request body — no id, no user_id
    pass

class SubscriptionPublic(SubscriptionBase):              # response — safe fields only
    id: int

class SubscriptionUpdate(SQLModel):                      # PATCH — every field optional
    name: str | None = None
    price: Decimal | None = None
    billing_cycle: BillingCycle | None = None
```

### Schema Validation

Use Pydantic v2 for **all** request bodies, query params, and config. Push validation into the schema (`Field(gt=0)`, `Field(max_length=...)`, validators) so invalid input is rejected with a 422 before it reaches your logic — the backend counterpart to using Zod for every form/action schema on the frontend. Don't hand-write validation in the route body.

### camelCase JSON via Aliases

The frontend speaks `camelCase`. Bridge it at the schema boundary with an alias generator and serialize by alias, keeping `snake_case` everywhere in Python. Use `validate_by_name` / `validate_by_alias` (Pydantic v2.11+) — the older `populate_by_name` is deprecated.

```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
    )

# billing_cycle (Python) <-> billingCycle (JSON), automatically, both directions
class SubscriptionPublic(CamelModel):
    id: int
    billing_cycle: BillingCycle
```

### Validate Query/Path Params at the Boundary

Anything the client controls — pagination, filters, sort, search — must be declared as a typed, constrained parameter (`Query(le=MAX_PAGE_SIZE)`, an enum for `sort_by`/`sort_order`) so FastAPI validates and documents it automatically. This is the backend mirror of the frontend's URL-state rule: the full result set must be reproducible from the request alone, and every input bound is enforced server-side, never trusted from the caller.

### Pagination, Not Unbounded Queries

Any endpoint returning a collection whose size is bounded by user data (subscriptions, transactions, insights) **must** paginate with `limit`/`offset` (or keyset) and a `MAX_PAGE_SIZE` cap. Never `select(Model).all()` an unbounded table into memory and serialize it. For genuinely large exports, use a `StreamingResponse`. This is the server-side counterpart to the frontend's "virtualize long lists" rule — both refuse to materialize N items when N is user-controlled.

Avoid N+1 queries: eager-load relationships (`selectinload`) or build a lookup `dict` from a single batched query instead of querying per row inside a loop — the backend version of "build lookup maps once."

### Partial Updates (PATCH)

For update endpoints, accept an all-optional `*Update` schema and apply **only the fields the client actually sent**, using `model_dump(exclude_unset=True)`. This preserves existing values and is the backend twin of the frontend's "only submit dirty fields" rule.

```python
@router.patch("/subscriptions/{sub_id}", response_model=SubscriptionPublic)
async def update_subscription(
    sub_id: int,
    data: SubscriptionUpdate,
    session: SessionDep,
    user: CurrentUser,
) -> Subscription:
    subscription = await session.get(Subscription, sub_id)
    if not subscription or subscription.user_id != user.id:
        raise HTTPException(status_code=404, detail="Subscription not found")

    update_data = data.model_dump(exclude_unset=True)   # only fields the client sent
    subscription.sqlmodel_update(update_data)
    session.add(subscription)
    await session.commit()
    await session.refresh(subscription)
    return subscription
```

### Consistent Error Responses

Raise `HTTPException` with the correct status code and a stable `detail` shape. Map domain exceptions to HTTP responses centrally with `@app.exception_handler(...)` rather than repeating `try/except` in every route. Validation failures should surface as 422 (Pydantic does this automatically) — don't catch and re-wrap them into 500s.

### Atomic Writes and Transactions

A request that performs multiple related writes must commit them in one transaction so a mid-way failure leaves no partial state. Commit once at the end of the unit of work; let the `yield` session dependency roll back on exception. This is the backend's correctness guarantee in the same spirit as the frontend's optimistic-update/rollback discipline — the server is the source of truth and must never persist a half-applied change.

### Idempotency for Unsafe Operations

Mutating endpoints that a client might retry (network blips, double-clicks) should be safe to call twice — enforce uniqueness constraints, or accept an idempotency key, so a retry doesn't create a duplicate subscription or double-charge. This is the server-side analogue of the frontend's "deduplicate toasts with a stable id": both prevent a repeated action from producing repeated effects.

## Data Handling

### Date/Time

Use timezone-aware `datetime` objects everywhere. Get "now" with `datetime.now(tz=timezone.utc)` — **never** the naive `datetime.utcnow()` or `datetime.now()`. Use `zoneinfo.ZoneInfo` for timezone conversions. Naive datetimes are the backend's silent-bug factory.

### Time Storage in UTC

**Always store timestamps in UTC** in the database (timezone-aware columns), and serialize them as ISO-8601 UTC strings. Convert to the user's timezone only at the presentation boundary — the storage layer is always UTC. Mirrors the frontend's "store UTC, display local" rule from the other side of the wire.

### Timezone Validation

Wrap timezone lookups in `try/except ZoneInfoNotFoundError` (or validate against `zoneinfo.available_timezones()`) with a sensible fallback, so a bad timezone string from a client never 500s the request.

### Money as Decimal, Never Float

All monetary values use `decimal.Decimal` (and `NUMERIC`/`DECIMAL` DB columns), never `float`. Floating-point arithmetic silently corrupts currency math.

```python
from decimal import Decimal

# ✅ Correct — exact
total = Decimal("10.50") * 3            # Decimal("31.50")

# ❌ Incorrect — binary float rounding error
total = 10.50 * 3                        # 31.499999999999996
```

Quantize to the currency's precision before persisting or returning: `amount.quantize(Decimal("0.01"))`. This is the backend counterpart of the frontend's "currency fixed to 2 decimals" rule — but done in the type system, where it actually protects the data.

### Parsing & Serialization

Parse external JSON through a Pydantic model (`Model.model_validate_json(...)`), not raw `json.loads` followed by manual key access — you get validation, defaults, and typed output in one step (the backend's `safeJSONParse`). Wrap any parsing/formatting of untrusted input in `try/except` (`ValidationError`, `ValueError`) with an explicit fallback or a 422, never an unhandled 500.

## Testing

- Use **pytest** with FastAPI's `TestClient` (sync) or `httpx.AsyncClient` + ASGI transport (async). Tests live under `tests/`, mirroring the `app/` package layout.
- **Override dependencies** with `app.dependency_overrides` to inject test DB sessions, fake clients, and stub auth — never reach into production resources. This is the payoff of routing all shared state through `Depends`.
- Test `service.py` functions directly (no HTTP) for logic, and the router via the client for the HTTP contract (status codes, response shape, validation errors).
- Assert on response **status codes and body shape**, referencing the same `constants.py` values the implementation uses, so tests stay in sync.
- Keep tests isolated: a transactional fixture that rolls back per test, or a disposable test database — never shared mutable state between tests.

## Linting & Formatting

- **ruff** is the single tool for both linting and formatting. Run `ruff check --fix` and `ruff format` before committing; CI enforces both.
- Enable at least `E`, `F`, `I` (import sorting), `UP` (pyupgrade), and `B` (bugbear) rule sets. Let `I` own import ordering so it's never argued about in review.
- 4-space indentation, ruff's default line length. Don't hand-format or disable rules inline without a `# noqa: <code>  # reason` comment explaining why.
