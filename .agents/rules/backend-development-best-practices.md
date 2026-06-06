---
trigger: always_on
---

# Backend Development Best Practices

## Use Enums

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
- **Refactor safety** — renaming a value updates every consumer; literal-string unions don't.
- **Call-site clarity** — `SubscriptionStatus.ACTIVE` reads as a named concept; `"active"` is a magic string.
- **Exhaustiveness** — `match` statements and type checkers can verify all enum members are handled.
- **Free OpenAPI schema** — FastAPI renders the enum as a proper `enum` in `/docs`, and DB columns can reference the same type.

**Placement**: shared enums live in the most-upstream module that owns the concept — typically `app/<feature>/constants.py`. SQLModel table models, Pydantic schemas, and service code all import from there.

## Concurrent I/O Instead of Sequential Awaits

Don't `await` independent coroutines one at a time in a loop. Gather them so I/O overlaps:

```python
import asyncio

# Avoid — serial; total latency is the sum of every call
results = []
for sub_id in subscription_ids:
    results.append(await fetch_subscription(sub_id))

# Prefer — concurrent; total latency is the slowest single call
results = await asyncio.gather(*(fetch_subscription(s) for s in subscription_ids))
```

For large fan-outs, bound concurrency with a `Semaphore` so you don't exhaust the DB connection pool or hit external rate limits.

## HTTP Client

Use a shared `httpx.AsyncClient` for outbound calls — **never** the blocking `requests` library inside `async` code (it blocks the event loop), and never create a new client per request. Construct one client at startup via the lifespan handler and inject it as a dependency, so connection pooling, timeouts, and tracing are configured once.

## Don't Block the Event Loop

In an `async def` route, never call blocking code directly (sync DB drivers, `time.sleep`, heavy CPU work, `requests`). Either use the async equivalent or offload with `await asyncio.to_thread(...)`. A single blocking call stalls every concurrent request on the worker.

## Function Parameters

When a function takes more than ~3 related parameters, group them into a Pydantic model or a dataclass instead of a long positional signature. Otherwise, make non-trivial parameters keyword-only with `*` so call sites stay self-documenting.

```python
# Avoid — positional soup; easy to transpose arguments
def create_subscription(name, price, currency, cycle, trial_days, user_id): ...

# Prefer — a validated input model
class CreateSubscriptionInput(BaseModel):
    name: str
    price: Decimal
    currency: str
    cycle: BillingCycle
    trial_days: int = 0

def create_subscription(*, user_id: int, data: CreateSubscriptionInput) -> Subscription: ...
```

## Avoid Re-export `__init__.py` Files

Import symbols directly from the module that defines them (`from app.subscriptions.service import create_subscription`) rather than funneling everything through a catch-all `__init__.py`. Keep `__init__.py` files empty. Barrels obscure where a symbol actually lives, create import cycles, and slow startup.

## Feature Package Structure

Wrap each feature in a package so its router, schemas, models, service logic, and constants live together. Use snake_case for module and package names:

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
```

**Why this matters**: This makes dependencies explicit and keeps the HTTP layer thin. `router.py` parses/validates and delegates; `service.py` holds logic and is unit-testable without spinning up the app. A flat `app/` of `routes.py`, `models.py`, `utils.py` makes every feature appear tangled with every other.

**Keep routers thin**: path operations should validate input, call a service function, and shape the response — nothing more. Business logic, DB queries, and external calls live in `service.py`, which imports no FastAPI symbols.

**Apply this pattern to all new work going forward.**

## Utility Module Structure

Give each non-trivial utility its own module with a colocated (or mirrored) test, rather than a grab-bag `utils.py`. Use snake_case:

```text
app/core/utils/
  format_currency.py
  proration.py
tests/core/utils/
  test_format_currency.py
  test_proration.py
```

**Why this matters**: isolated modules make it obvious what each test covers and keep unit tests focused.

**Apply this pattern to all new work going forward.**

## Extract Constants for Testing

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
# tests assert against the same constants the implementation uses
```

**Why this matters**:

- Single source of truth - constants defined once
- Tests automatically stay in sync with implementation changes
- Refactoring is safer - change constant in one place
- Reduces test brittleness and maintenance burden

**When to extract constants**:

- Default query params (page size, sort)
- Configuration objects (pagination, filters, sort options)
- Magic numbers or strings used in logic
- Any value that tests need to reference

**File structure**:

```text
subscriptions/
  router.py            # Implementation
  service.py           # Logic
  constants.py         # Shared constants
tests/subscriptions/
  test_router.py       # Tests
```

## Async/Await

Prefer `async def` endpoints and async drivers throughout the request path. Use `await` directly; don't wrap a single awaitable in `asyncio.gather` unless you genuinely have multiple to run concurrently. If a route must touch a sync-only library, isolate it behind `asyncio.to_thread`.
