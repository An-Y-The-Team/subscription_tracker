---
trigger: always_on
---

# General typescript Development principles

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
