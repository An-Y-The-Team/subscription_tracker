---
trigger: always_on
---

# Development Best Practices

## Use Enums

**Never declare a field as a literal-string union** (e.g. `type: "image" | "storyboard"`). Define an `enum` (or `as const` object + `keyof typeof` type) and reference it on the field. Applies to discriminator fields, status fields, type-tag fields, alignment / orientation / direction fields — anything where the set of valid values is closed and finite.

```typescript
// ❌ Avoid — literal-string union inline on the field
export type Cel = {
  type: "image" | "storyboard" | "note" | "speech_bubble";
  role: "composition" | "reference";
};

// ✅ Prefer — enum referenced from a shared constants module
export enum CelType {
  IMAGE = "image",
  STORYBOARD = "storyboard",
  NOTE = "note",
  SPEECH_BUBBLE = "speech_bubble",
}

export enum CelRole {
  COMPOSITION = "composition",
  REFERENCE = "reference",
}

export type Cel = {
  type: CelType;
  role: CelRole;
};
```

**Why this matters**:

- **Single source of truth** — the set of valid values is defined once. Adding a new variant (e.g. `CelType.VIDEO`) is one edit, not a grep-and-replace across every union site.
- **Refactor safety** — renaming a value updates every consumer; literal-string unions don't.
- **Call-site clarity** — `CelType.IMAGE` reads as a named concept; `"image"` is a magic string.
- **Switch exhaustiveness** — TypeScript's `never` exhaustiveness check works better with enums than with re-typed literal unions.

**Placement**: shared enums (used by more than one entity) live in the most-upstream package that defines the concept — typically `@frontend/db/entities/<entity>/constants.ts`. Both DB types and Liveblocks types import from there.

## Batch Processing

Use `batchProcess` from `@frontend/shared/utils` instead of manual for loops with await:

```typescript
// Avoid
for (const item of items) {
  await processItem(item);
}

// Prefer
await batchProcess(items, async (item) => {
  await processItem(item);
});
```

## API Client

Use `api.[method]` from `@frontend/shared/api` instead of native `fetch()`. Set up with `ApiProvider` and `initializeApi()` for automatic Sentry instrumentation, error handling, and request tracing.

## Avoid return await

Don't use `return await` pattern. Instead use `const result = await func(); return result;` for better stack traces and debugging.

## Function Parameters

Always use object parameters for functions instead of multiple individual parameters:

```typescript
// Avoid
function createUser(name: string, email: string, age: number) {}

// Prefer
function createUser({
  name,
  email,
  age,
}: {
  name: string;
  email: string;
  age: number;
}) {}
```

## Component Files

Create component files directly (e.g., `component.tsx`) instead of using index files. Avoid creating `index.tsx` files for components - import components directly by their filename.

### Component File Structure

Wrap components in a folder to organize related files (utilities, hooks, types, child components). Use kebab-case for folder and file names:

```text
visual-v2/
  visual-v2.tsx          # Main component
  components/
    co-script-blocks/
      co-script-blocks.tsx # Child component used only in visual-v2
  hooks/
    use-visual-data
      use-visual-data.ts   # Hooks used only in visual-v2
  types
    types.ts               # Types used only in visual-v2
  utils
    utils.ts               # Utilities used only in visual-v2
```

**Why this matters**: This structure makes dependencies explicit. When child components like `CoScriptBlocks` are only used inside `Content`, placing them in a `components/` subfolder clarifies the relationship. A flat structure makes all components appear equal in importance, making it harder to understand component hierarchies and dependencies.

**Apply this pattern to all new work going forward.**

## Utility File Structure

Organize utility functions in individual folders instead of combining them in a single file. Use kebab-case for folder and file names:

```text
utils/
  format-time/
    format-time.ts
    format-time.test.ts
  calculate-duration/
    calculate-duration.ts
    calculate-duration.test.ts
  parse-episode-data/
    parse-episode-data.ts
    parse-episode-data.test.ts
```

**Why this matters**: This structure makes unit testing easier and more maintainable. Each utility has its own isolated test file, making it clear what's being tested. Avoid combining multiple utilities in `utils.ts` or `index.ts` files.

**Apply this pattern to all new work going forward.**

## Extract Constants for Testing

**Proactively extract constants** to a separate file when writing code that will be tested. This makes test setup easier and keeps tests in sync with implementation.

```typescript
// constants.ts
export const DEFAULT_STORIES_PER_PAGE = 10;
export const DEFAULT_TABLE_PARAMS = {
  page: 1,
  limit: DEFAULT_STORIES_PER_PAGE,
  sortBy: STORIES_SORT_BY.UPDATED_AT,
  sortOrder: SORT_ORDER.DESC,
};

// feature.tsx
import { DEFAULT_TABLE_PARAMS } from "./constants";

export function StoriesList() {
  const [params, setParams] = useState(DEFAULT_TABLE_PARAMS);
  // ...
}

// feature.test.tsx
import { DEFAULT_TABLE_PARAMS } from "./constants";

describe("StoriesList", () => {
  const defaultPageParams = {
    table: DEFAULT_TABLE_PARAMS,
  };
  // Tests use same constants as implementation
});
```

**Why this matters**:

- Single source of truth - constants defined once
- Tests automatically stay in sync with implementation changes
- Refactoring is safer - change constant in one place
- Reduces test brittleness and maintenance burden

**When to extract constants**:

- Default values for component state or props
- Configuration objects (pagination, filters, sort options)
- Magic numbers or strings used in logic
- Any value that tests need to reference

**File structure**:

```text
feature/
  feature.tsx          # Implementation
  feature.test.tsx     # Tests
  constants.ts         # Shared constants
```

## Async/Await

Always use async/await instead of Promise.then().catch() for better readability and error handling.
