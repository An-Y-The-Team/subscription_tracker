# Shared API Client

A lightweight fetch wrapper that provides consistent error handling and optional Sentry instrumentation.

## Usage

### Basic Usage

```typescript
import { api } from "@/shared/api";

// GET request
const data = await api.get("/api/stories");

// POST request
const result = await api.post("/api/stories", {
  title: "New Story",
  content: "...",
});

// Other methods: put, patch, delete
await api.put("/api/stories/123", { title: "Updated" });
await api.delete("/api/stories/123");
```

### With React Query

```typescript
import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/shared/api";

// Query
const { data, isLoading } = useQuery({
  queryKey: ["stories"],
  queryFn: () => api.get("/api/stories"),
});

// Mutation
const mutation = useMutation({
  mutationFn: (data) => api.post("/api/stories", data),
});
```

### Error Handling

The API client automatically throws on non-OK responses:

```typescript
import { isApiError } from "@/shared/api";

try {
  const data = await api.get("/api/stories/123");
} catch (error) {
  if (isApiError(error)) {
    console.log(error.status); // HTTP status code
    console.log(error.response); // Response body
  }
}
```

## Sentry Integration

Sentry tracking is automatically added when:

1. The app includes `<ApiProvider>` in the layout
2. Sentry is initialized (NEXT_PUBLIC_SENTRY_DSN is set)

This provides:

- Performance monitoring for all API calls
- Automatic error capture with context
- Request/response breadcrumbs

## Migration Guide

Replace raw fetch calls:

```typescript
// Before
const response = await fetch("/api/stories");
if (!response.ok) {
  throw new Error(`Failed: ${response.status}`);
}
const data = await response.json();

// After
const data = await api.get("/api/stories");
```

## Benefits

- **Type Safety**: Full TypeScript support with generics
- **Consistent Error Handling**: Automatic error throwing on non-OK responses
- **Optional Instrumentation**: Sentry integration without hard dependencies
- **Timeout Support**: Built-in request timeouts (30s default)
- **Clean API**: Simple, intuitive methods for all HTTP verbs.
