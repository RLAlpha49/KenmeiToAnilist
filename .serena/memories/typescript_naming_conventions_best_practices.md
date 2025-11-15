# TypeScript Naming Conventions — Best Practices

This memory documents general, community-accepted TypeScript naming conventions to use as a reference. Do not model conventions solely off a particular codebase — prefer the general best-practices here.

## 1. General style

- Use camelCase for variable, function, and property names: `let totalCount`, `const userName`.
- Use PascalCase for types, interfaces, enums and classes: `User`, `UserService`, `HttpStatus`.
- Use SCREAMING_SNAKE_CASE for compile-time constants or environment variables that are effectively global constants: `MAX_RETRIES`, `DEFAULT_TIMEOUT_MS`.
- File and directory names: prefer kebab-case for regular modules `user-service.ts`, and PascalCase for React components `UserCard.tsx` (or `UserCard/index.tsx`). Keep the project consistent.

## 2. Types and interfaces

- Prefer PascalCase for type alias and interface names: `User`, `UserDto`, `FetchResult<T>`.
- Avoid prefixing interfaces with `I` in modern TypeScript (e.g., not `IUser`); prefer `User`. The `I` prefix is legacy MS-style and often redundant.
- For React component props, use `ComponentProps` or `ComponentNameProps`:
  - `interface UserCardProps { user: User }`
- Use `Readonly` or `…Params` suffixes for function/constructor arguments when appropriate: `CreateUserParams`, `UpdateUserOptions`.

## 3. Classes and constructors

- Class names: PascalCase (`class UserService`).
- Private fields: prefer `private`/`protected` keywords over underscore prefixes. If you choose to use underscores to denote intent, keep it consistent: `_internalState`.
- Factory functions: use `create` prefix, e.g., `createUser`, not `newUser`. Avoid prefixing class constructors (they’re implicit).

## 4. Functions and methods

- Use verbs for functions (`get`, `fetch`, `create`, `validate`): `fetchUser`, `calculateScore`.
- Event handler naming: `handle` vs `on` both are useful:
  - internal callback: `handleSubmit` — function body
  - handler prop: `onSubmit` — props exposed to children
- Prefer descriptive names, avoid abbreviations: `calculateInvoiceTotal` not `calcInvTot`.
- Suffix `Async` is optional. Many teams avoid it and rely on the return type (Promise). If you use it, apply consistently: `fetchUserAsync`.

## 5. Booleans, predicates and flags

- Prefix boolean variables or functions that return boolean with: `is`, `has`, `can`, `should`: `isActive`, `hasPermission`, `canDelete`, `shouldRetry`.
- Function returning boolean should be a predicate: `isValidName(name)`.

## 6. Generics

- Use single-letter type variables for short ones: `T`, `K`, `V`.
- For descriptive generics use readable PascalCase names: `TItem`, `TInput`, `TOutput`, `TReturn` or `Entity`.
- Use `T` for general items — `Array<T>`, `Promise<T>`.

## 7. Enums

- Use PascalCase for enums and their values: `enum HttpMethod { Get = "GET", Post = "POST" }`.
- Prefer `const enum` only when you know the code will be compiled and need inlining; otherwise use normal `enum`.

## 8. Constants and readonly values

- Global compile-time constants: UPPER_SNAKE_CASE (`API_BASE_URL`, `DEFAULT_PAGE_SIZE`).
- Module-level constants: prefer camelCase or PascalCase depending on context: `const defaultTimeoutMs = 5000` or `const DEFAULT_TIMEOUT_MS = 5000` (choose one approach consistently).
- For named constants representing complex objects or configuration: `const defaultConfig: Config = { ... }`.

## 9. Files & folders

- File names: pick a consistent rule across the repository. Two common patterns:
  - Use kebab-case for normal modules: `user-service.ts`, `auth-utils.ts`.
  - Use PascalCase for files exporting a single class/component: `UserCard.tsx`.
- Test files: suffix with `.spec.ts` or `.test.ts` matching team choice—`UserService.spec.ts` or `UserService.test.ts`.
- Barrel files: keep `index.ts` usage minimal and explicit. Name public exports clearly when re-exporting from a barrel.

## 10. React conventions

- Components names are PascalCase, file names usually match the component: `UserCard.tsx`.
- Props interface name: `UserCardProps`.
- State interface name: `UserCardState` if used.
- Hooks: prefix with `use` and use camelCase: `useUser`, `useDebouncedValue`.
- Event handlers in props: `onClose`, `onDelete`, `onChange`. Local handler names inside components often use `handle` prefix: `handleClose`.

## 11. Redux / store / actions

- Actions: use verbs: `setUser`, `updateUser`, `resetUsers`.
- Reducer and slice names should describe the domain: `authSlice`, `userSlice`.

## 12. Test naming

- Tests should include what is being tested plus the scenario. Example: `it('returns empty list if there are no items', ...).`
- Keep test filenames consistent and adjacent to their modules. Example `user-utils.spec.ts` or `user-service.spec.ts`.

## 13. Exceptions & when to break the rules

- When interacting with external APIs or third-party libraries, use names that reflect the external API (e.g., using the external field names during network serialization). Document these exceptions.
- For very short-lived local variables in tight blocks or loops (like an index), `i`, `j` are acceptable.

## 14. Why these conventions?

- Readability: camelCase for runtime values and PascalCase for types/classes gives a quick visual marker.
- Predictability: consistent naming reduces cognitive load for new contributors.
- Tooling: TypeScript type system expects predictable naming and coding patterns — e.g., PascalCase makes it clear when something is a type or a class.

## 15. Naming checklist (quick)

- [ ] Variables & function names: camelCase
- [ ] Types, interfaces, classes, enums: PascalCase
- [ ] Boolean variables: start with is/has/can/should
- [ ] React component: PascalCase, props: ComponentProps
- [ ] File names: kebab-case or match component naming rule, be consistent
- [ ] Constant global values: UPPER_SNAKE_CASE (optional), otherwise camelCase
- [ ] Avoid `I` prefix for interfaces
- [ ] Generic type variables: single-letter or descriptive PascalCase

## 16. Small examples

- Good: `interface User { id: number; name: string }`
- Bad: `interface IUser { id: number; name: string }`
- Good: `const MAX_RETRIES = 5;`
- Good: `function fetchUsers(): Promise<User[]>`.
- Good: `function isValidEmail(email: string): boolean`.
- React: `function UserCard({ user }: UserCardProps) { ... }`.

---

This memory is meant to be a canonical reference for naming style. When there are differences between this memory and a repository's local conventions, prefer the repository's documented standards for that repo — but when introducing new code or refactoring, use these TypeScript best-practices as a baseline where reasonable.
