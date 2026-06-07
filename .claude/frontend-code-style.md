# Frontend NextJs (React) Code Style Guidelines

## General Principles

- **TypeScript**: Use strict typing, **never use `any` type**. Use specific types, `unknown`, or proper generics instead
- **Optional Chaining**: Always use optional chaining (`?.`) for object property access, regardless of TypeScript types
- **Imports**: Group by external/internal, alphabetized
- **Components**: Functional React components with explicit props typing
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Error Handling**: Use try/catch for async operations, proper error types
- **State Management**: Use React hooks pattern, minimize prop drilling
- **File Structure**: Feature-based organization in apps
- **Formatting**: Prettier enforced, 2-space indentation
- **UI Components**: Prefer composition across apps

## Development Best Practices

### Use Enums

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

**Placement**: shared enums (used by more than one feature) live in the most-upstream module that defines the concept — typically `@/constants` (e.g. `@/constants/sex.ts`). Feature-specific enums live in `@/features/<feature>/constants`. Both the schema/types and any consumers import from there.

### Batch Processing

Use `batchProcess` from `@/utils` instead of manual for loops with await:

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

### API Client

Use `api.[method]` from `@/shared/api` instead of native `fetch()`. Set up with `ApiProvider` and `initializeApi()` for automatic Sentry instrumentation, error handling, and request tracing.

### Avoid return await

Don't use `return await` pattern. Instead use `const result = await func(); return result;` for better stack traces and debugging.

### Function Parameters

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

### Component Files

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

### Utility File Structure

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

### Extract Constants for Testing

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

### Async/Await

Always use async/await instead of Promise.then().catch() for better readability and error handling.

## React & Next.js Patterns

### Named Event Handlers

**Never inline complex logic directly in JSX event props.** Always define named handler functions above the `return` statement with a descriptive name and a comment explaining what it does.

```tsx
// ❌ Avoid — logic buried in JSX, new function reference on every render
<Select
  onValueChange={(val) => {
    const newTime = convertTime12HourTo24Hour(Number(val), period);
    setSessionDeadlines((prev) => ({
      ...prev,
      [sessionId]: { date: prev[sessionId]?.date || new Date(), time: newTime },
    }));
  }}
/>;

// ✅ Prefer — named handler defined above return, easy to read and review
// Hour select — updates only the hour part of this session's deadline time.
const handleHourChange = (val: string) => {
  const newTime = convertTime12HourTo24Hour(Number(val), period);
  setSessionDeadlines((prev) => ({
    ...prev,
    [sessionId]: { date: prev[sessionId]?.date || new Date(), time: newTime },
  }));
};

// In JSX:
<Select onValueChange={handleHourChange} />;
```

**Why this matters**:

- Inline arrow functions create a new reference on every render, causing unnecessary re-renders of child components that receive the handler as a prop
- Named handlers are easier to read, review, and test in isolation
- Comments on named handlers explain _why_ the logic exists, which is lost when buried in JSX

**Rule**: Any event handler with more than one statement, or any logic beyond a simple setter call, must be extracted as a named function.

### Context Providers for Shared State

**Proactively use Context providers** to prevent props drilling when multiple components need access to the same state or data.

**When to use Context**:

- ✅ State/data shared by 3+ components at different nesting levels
- ✅ Complex state that needs to be accessed throughout a feature
- ✅ Shared handlers or callbacks used by multiple child components
- ✅ Configuration or settings needed by many components

**When NOT to use Context**:

- ❌ Data only used by 1-2 components (use props)
- ❌ Simple parent-child relationships (use props)
- ❌ Global app-wide state (use specialized solutions)

**Example - BAD (Props Drilling)**:

```typescript
// ❌ Props drilling through multiple levels
function PaymentsPage() {
  const [filters, setFilters] = useState({});
  const [selection, setSelection] = useState({});

  return (
    <PaymentsTable
      filters={filters}
      setFilters={setFilters}
      selection={selection}
      setSelection={setSelection}
    >
      <PaymentsHeader
        filters={filters}
        setFilters={setFilters}
        selection={selection}
      />
      <PaymentsBody
        filters={filters}
        selection={selection}
        setSelection={setSelection}
      >
        <PaymentRow
          selection={selection}
          setSelection={setSelection}
        />
      </PaymentsBody>
    </PaymentsTable>
  );
}
```

**Example - GOOD (Context Provider)**:

```typescript
// ✅ Context provider wraps the feature
function PaymentsPage() {
  return (
    <PaymentsProvider>
      <PaymentsTable>
        <PaymentsHeader />
        <PaymentsBody>
          <PaymentRow />
        </PaymentsBody>
      </PaymentsTable>
    </PaymentsProvider>
  );
}

// Context implementation
const PaymentsContext = createContext<PaymentsContextValue | null>(null);

export function PaymentsProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState({});
  const [selection, setSelection] = useState({});

  return (
    <PaymentsContext.Provider value={{ filters, setFilters, selection, setSelection }}>
      {children}
    </PaymentsContext.Provider>
  );
}

export function usePayments() {
  const context = useContext(PaymentsContext);
  if (!context) {
    throw new Error("usePayments must be used within PaymentsProvider");
  }
  return context;
}

// Usage in any child component
function PaymentRow() {
  const { selection, setSelection } = usePayments();
  // No props needed!
}
```

**Context Provider Pattern Structure**:

```text
feature/
  feature-provider.tsx     # Context provider and hook
  feature.tsx              # Main component
  components/
    child-component.tsx    # Uses context via hook
```

**Benefits**:

- 🎯 Cleaner component props (no drilling)
- 🔧 Easier refactoring (move components without updating props)
- 📖 Better readability (clear data dependencies)
- ⚡ Prevents unnecessary re-renders (with proper memoization)

### Memoize Context Values

**Always memoize context provider values** using `useMemo` to prevent unnecessary re-renders of consuming components:

```typescript
// ❌ Avoid - creates new object every render
<Context.Provider value={{ state, setState }}>

// ❌ Also avoid - spreading a hook return is still a new object
<Context.Provider value={{ ...values, type: "x" }}>

// ✅ Prefer - only re-creates when dependencies change
const value = useMemo(() => ({ state, setState }), [state]);
<Context.Provider value={value}>
```

**This applies even when the source is a custom hook**: if `useFooValues()` returns a fresh literal each render (no internal `useMemo`), wrapping the provider's `value` in `useMemo` is required.

**State setters from `useState` are referentially stable** and don't need to be in the deps array — only state values, derived data, and unstable callbacks do.

The cost of getting this wrong scales with the consumer count: a context read by N per-item nodes (rows, decorators, table cells) re-renders all N on every parent render. See [.claude/liveblocks.md — Subscription Scope](./liveblocks.md#subscription-scope-usestorage-selectors) for the same pitfall on the Liveblocks side.

### Rendering Large Lists

Any list whose length is bounded by user content (scenes, panels, tracks, search results, asset libraries) **must be virtualized** if it can grow past ~100 items. Use [`react-virtuoso`](https://virtuoso.dev/) or [`@tanstack/react-virtual`](https://tanstack.com/virtual) — don't render N DOM nodes for N items.

Other patterns to follow when rendering N items:

- **Don't put `lodash.isEqual` in `React.memo` comparators.** Deep equality on every parent render is O(n × depth). Compare by stable IDs (`hashBlockId`, primary keys) and a small set of relevant primitive fields.
- **Build lookup maps once.** A `useMemo` like `items.map((x) => other.find((y) => y.id === x.id))` is O(n²) — build a `Map` in the same `useMemo` first, then look up.
- **Keep contexts that fan out to per-item nodes minimal.** If a context value carries the full list and one item subscribes per row, every list mutation re-renders every row. Split frequently-changing state (per-item) from stable methods/values into separate contexts.
- **Hoist inline closures.** `onClick={() => handle(id)}` passed to a memoized child defeats the memo. Use `useCallback` with the args closed over, or pass `id` as a prop and have the child build the closure itself.

### Loading States

Add `loading.tsx` for each page to improve perceived routing speed and enable immediate UI response during route transitions.

### Loading UI: Skeletons vs Spinners

Use different loading indicators based on the data fetching state:

- **Skeletons** (`isLoading`): Use for initial/first load when no data exists yet. Skeletons provide a preview of the content layout, reducing perceived loading time.
- **Opacity dim + spinner** (`isFetching && !isLoading`): Use for refetches when data already exists (filter changes, pagination, search). Dim the existing content and show a corner spinner so the user sees fresh data is loading without a jarring layout swap.

Always destructure both `isLoading` and `isFetching` from the hook and gate the spinner with `isFetching && !isLoading` so the cold-load path shows only the skeleton, never the skeleton + spinner together.

```tsx
// Generic pattern
const { data, isLoading, isFetching } = useQuery(...);

if (isLoading) {
  return <ContentSkeleton />;
}

return (
  <div className="relative">
    {isFetching && !isLoading && (
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )}
    <div className={cn(isFetching && !isLoading && "opacity-60 transition-opacity")}>
      <Content data={data} />
    </div>
  </div>
);
```

```tsx
// Paginated table pattern (preferred for tables with filters/pagination)
// Skeleton rows on cold load; on refetch dim the TableBody and overlay a spinner in the corner.
const { data: rows, isLoading, isFetching } = useFilterX(...);

return (
  <div className="relative rounded-md border">
    {isFetching && !isLoading && (
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    )}
    <Table>
      <TableHeader>...</TableHeader>
      <TableBody
        className={cn(
          isFetching && !isLoading && "opacity-60 transition-opacity"
        )}
      >
        {isLoading ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <EmptyRow />
        ) : (
          rows.map(...)
        )}
      </TableBody>
    </Table>
  </div>
);
```

Use `Loader2` from `lucide-react` with `animate-spin` (the codebase convention) and `cn` from `@/lib/cn`.

**Why this matters**: Skeletons during initial load set user expectations for content layout. Dim + centered spinner during refetch keeps stale rows visible while signaling that new data is on the way — avoids the layout flash that happens when filter/pagination changes swap rows back to skeletons. The spinner overlays the container with `absolute inset-0 flex items-center justify-center` so it sits in the visual center regardless of table size.

### Data Mutations

Use Server Actions instead of API routes in Next.js apps.

### Form State

Use `useActionState` hook (React 19+) instead of `useFormState`.

### Schema Validation

Use Zod for all action and form schemas.

### Next.js 15

Page params are Promises that must be awaited.

### URL State Synchronization

Anything visible on the page should be reproducible by another user simply by pasting the URL into their browser. Use `usePageParams` to ensure this synchronization, with a Zod schema when you need structured validation and defaults.

**Validating against dynamic data (optional):** When some URL fields depend on data that is not available at `usePageParams` parse time (e.g. clamping `table.page` with `totalPages` from an API), call `registerDynamicParamsGuard` from the `usePageParams` return value during render after that data is available. Build constraints with helpers from `@/hooks` (`cap`, `oneOf`, `arraySubsetOf`, etc. — see `dynamic-params-constraints`). Only one guard registration should run meaningful constraint evaluation per `usePageParams` instance per render (merged constraint object). If all rules are static, use Zod on `usePageParams` only.

### Error Handling with Hooks

**CRITICAL**: Be aware that hooks from third-party libraries (Clerk, Liveblocks, etc.) can throw exceptions.

**Current Pattern**: Most components do not handle hook exceptions and will crash. This is acceptable if:

1. The hook is critical to the component (e.g., `useOrganization` for org-scoped data)
2. Error boundaries at higher levels catch and display error UI

**Example - Component that crashes on hook error**:

```typescript
export function StoriesList() {
  // Will throw if Clerk fails - this is OK if error boundary handles it
  const { isLoaded: orgLoaded } = useOrganization();

  // Component implementation...
}
```

**Example - Component with error boundary handling**:

```typescript
// error.tsx in the same directory
export default function StoriesError({ error }: { error: Error }) {
  return (
    <div>
      <h2>Failed to load stories</h2>
      <p>{error.message}</p>
    </div>
  );
}
```

**When to add explicit error handling**:

- ✅ Hook failure is expected and recoverable (network errors, permission issues)
- ✅ Component can render a useful error state
- ✅ Graceful degradation improves UX
- ❌ Hook is critical and component can't function without it (let error boundary handle it)

## Edit Forms Pattern

For edit/update forms, only allow submission when there are actual changes (`form.formState.isDirty`). Only submit fields that have been modified:

```typescript
// Avoid - submitting all fields
const handleSubmit = form.handleSubmit((data) => {
  const formData = new FormData();
  formData.append("field1", data.field1);
  formData.append("field2", data.field2);
});

// Prefer - only submit changed fields
const handleSubmit = form.handleSubmit((data) => {
  const formData = new FormData();
  const { dirtyFields } = form.formState;

  if (dirtyFields.field1) formData.append("field1", data.field1);
  if (dirtyFields.field2) formData.append("field2", data.field2);
});

// Disable button when no changes
<Button disabled={isPending || !form.formState.isDirty}>
  Save Changes
</Button>
```

### Server Actions for Updates

Only include fields in the database update object that were actually sent in the FormData:

```typescript
// Avoid - updating all fields regardless of what changed
const updateData = {
  field1: validatedFields.data.field1,
  field2: validatedFields.data.field2,
};

// Prefer - only update fields that were sent
const updateData: Partial<DbModel> = {};
if (formData.has("field1")) updateData.field1 = validatedFields.data.field1;
if (formData.has("field2")) updateData.field2 = validatedFields.data.field2;
```

### Optimistic Updates

Use `queryClient.setQueryData` before `queryClient.invalidateQueries` for immediate UI feedback:

```typescript
const { resetActionProcessed } = useServerAction(actionState, isPending, {
  onSuccess: () => {
    // Optimistically update the query data first
    if (actionState?.data && entityId) {
      queryClient.setQueryData(
        ["entityById", entityId],
        (oldData: EntityData | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            status: actionState.data?.new_status || oldData.status,
          };
        }
      );
    }
    // Then invalidate to ensure fresh data from server
    queryClient.invalidateQueries({
      queryKey: ["entityById", entityId],
    });
  },
});
```

## UI Patterns

### Scrollbars and Layout Shifts

Use the `ScrollArea` component from `@/components/ui/scroll-area` instead of native CSS/Tailwind overflow properties (like `overflow-auto`, `overflow-scroll`) for scrollable containers.

**Why this matters**: Native scrollbars can cause layout shifts when the user connects a mouse (changing from overlay scrollbars to legacy scrollbars on some OS configurations). `ScrollArea` uses custom overlay scrollbars that do not take up layout space, ensuring consistent content dimensions regardless of the user's input device.

```tsx
// Avoid - causes layout shift when mouse connected
<div className="overflow-auto h-full w-full">{content}</div>;

// Prefer - consistent dimensions
import { ScrollArea } from "@/components/ui/scroll-area";

<ScrollArea className="h-full w-full">{content}</ScrollArea>;
```

## Data Handling

### Date/Time

Use Day.js for all date/time formatting, parsing, and manipulation instead of native Date methods.

### Time Data Storage

Always save time data as ISO UTC strings using `dayjs().utc().toISOString()`. Display in local/user timezones for UI, but store in UTC.

### Timezone Validation

Always wrap timezone operations in try/catch blocks with error handling and fallbacks for invalid timezone strings.

### JSON Parsing

Use `safeJSONParse` from `@/utils` instead of `JSON.parse`. Provides type safety, null handling, and fallback values.

### Data Formatting

Always wrap data formatting operations (JSON.parse, timezone formatting, date parsing, etc.) in try/catch blocks with appropriate fallbacks.

### Pluralization

Use `pluralize(count, singular, plural?)` from `@/utils` instead of inline `${count > 1 ? "s" : ""}` ternaries. Returns the noun only — caller adds the count.

```typescript
// ✅ Correct
import { pluralize } from "@/utils";
toast.success(`Updated ${count} ${pluralize(count, "session")}`);
<span>{count} {pluralize(count, "panel")}</span>
toast.error(`Imported ${n} ${pluralize(n, "child", "children")}`); // irregular

// ❌ Avoid
toast.success(`Updated ${count} session${count > 1 ? "s" : ""}`); // wrong for count = 0
toast.success(`Updated ${count} session${count !== 1 ? "s" : ""}`);
<span>{count} panel{count !== 1 ? "s" : ""}</span>
```

**Why**: `> 1` is wrong for 0 ("0 file" reads worse than "0 files"). `pluralize` handles `count === 1` correctly, lets us change rules in one place, and supports irregular plurals via the third arg. Adjacent-token JSX patterns like `Panel{x !== 1 ? "s" : ""}` should be restructured to `{pluralize(x, "Panel")}`.

### Currency Formatting

All currency values must be fixed to a maximum of 2 decimal places:

```typescript
// Correct - Fixed to 2 decimal places
const amount = 10.5;
const total = (amount * 1.5).toFixed(2); // "15.75"
const price = parseFloat((amount * 2).toFixed(2)); // 21.00

// Incorrect - Raw floating-point arithmetic
const total = amount * 1.5; // 15.750000000000002
```

## Toast Notifications

### Prevent Duplicate Toasts

**Always pass a stable `id` to `toast()` calls that can be triggered multiple times in rapid succession** (e.g., file validation errors, upload errors, network errors in loops). Without an `id`, each call stacks a new toast on screen.

```typescript
// ❌ Avoid — fires a new toast every time the handler runs
toast.error("Image exceeds maximum size (3MB). Please upload a smaller file.");

// ✅ Prefer — sonner deduplicates; only one toast is shown at a time
const UPLOAD_IMAGE_ERROR_ID = "upload-image-size-error";

toast.error("Image exceeds maximum size (3MB). Please upload a smaller file.", {
  id: UPLOAD_IMAGE_ERROR_ID,
});
```

**When to use an `id`**:

- Validation errors inside Uppy `file-added` / `file-validation-error` callbacks (fires once per file when multiple files are dropped)
- Upload error handlers called in a loop or batch
- Any `toast` call inside a `forEach`, `map`, or event listener that can fire repeatedly

**Naming convention**: Define the ID as a module-level constant with a descriptive name:

```typescript
const UPLOAD_IMAGE_ERROR_ID = "upload-reference-image-error";
const SESSION_SAVE_ERROR_ID = "session-save-error";
```

**Why this matters**: Users who drop multiple oversized files see the same error message duplicated N times. A single, deduplicated toast gives a cleaner UX and prevents toast queue overflow.
