---
name: typescript-refactoring
description: Refactor existing TypeScript code while preserving its architecture, public interfaces, observable behavior, and established project conventions. Use when improving type safety, readability, control flow, method structure, responsibility boundaries, imports, or file organization. Prefer strict typing, classes and interfaces, constructor-based dependency injection, IoC, early returns, small linear methods, grouped instructions, minimal nesting, and imports sorted from the shortest statement to the longest. Verify changes using existing tests, TypeScript compilation, and ESLint.
compatibility: opencode
metadata:
  language: typescript
  category: refactoring
---

# TypeScript Refactoring

Refactor existing TypeScript code to improve type safety, readability, maintainability, and consistency without changing its architecture, public interfaces, observable behavior, or business logic.

## Priorities

Apply these priorities in order:

1. Preserve consistency with the existing project.
2. Preserve correctness and existing behavior.
3. Improve readability and maintainability.
4. Strengthen TypeScript typing.
5. Follow the project's existing architecture.
6. Apply Clean Architecture principles where they fit naturally.
7. Prefer classes, interfaces, IoC, and dependency injection.
8. Make the smallest complete refactoring.

Project consistency takes precedence over this skill's stylistic preferences unless the existing style significantly harms readability, type safety, or maintainability.

Do not introduce a new architecture, framework, or design pattern merely to make the code more theoretically correct.

## Allowed Scope

You may:

- Improve TypeScript types.
- Remove unsafe or ambiguous typing.
- Improve naming and readability.
- Simplify control flow.
- Reduce nesting.
- Extract small, focused methods.
- Split large files into focused files.
- Extract interfaces and implementation contracts.
- Improve existing dependency injection boundaries.
- Reorganize private implementation details.
- Remove duplication when doing so does not create unnecessary abstraction.
- Update tests when required to preserve existing behavior.
- Reorder and clean up imports.

You must not:

- Change the existing application architecture.
- Change public APIs or exported contracts.
- Change externally observable behavior.
- Change business rules.
- Rename public methods, DTO fields, events, configuration keys, API properties, or persistence fields.
- Introduce unrelated functionality.
- Replace established project patterns without a strong correctness or readability reason.
- Perform broad cleanup outside the requested scope.
- Add abstractions that are not justified by current code.
- Add or replace dependencies unless explicitly requested.

## Inspect the Project First

Before changing code:

1. Inspect the target file and nearby related files.
2. Identify existing conventions for naming, file structure, typing, dependency injection, errors, tests, and imports.
3. Identify public interfaces and behavior that must remain unchanged.
4. Reuse existing project utilities and abstractions.
5. Avoid creating a parallel implementation of a pattern that already exists.

When the project has a clear convention, follow it unless it produces unsafe or seriously unreadable code.

When no clear convention exists, use the rules in this skill.

## Architectural Style

Prefer object-oriented TypeScript based on:

- Classes for services, use cases, handlers, repositories, mappers, and infrastructure implementations.
- Interfaces for contracts and dependency boundaries.
- Constructor-based dependency injection.
- IoC container registration when the project already uses an IoC container.
- Explicit separation between contracts and implementations.
- Dependencies directed toward abstractions rather than concrete infrastructure components.

Example:

```typescript
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
}

export class GetProduct {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id);
    }
    return product;
  }
}
```

Do not introduce a new IoC framework if the project does not already use one.

Do not reorganize modules or layers solely to enforce Clean Architecture terminology.

## Strict Type Safety

Use the strictest practical TypeScript typing.

Required rules:

- Do not introduce `any`.
- Replace existing `any` when its real type can be determined within the requested scope.
- Prefer `unknown` for genuinely unknown external values.
- Narrow `unknown` before using it.
- Avoid type assertions unless a runtime guarantee has already been established.
- Never use double assertions such as `value as unknown as SomeType`.
- Avoid non-null assertions unless the invariant is explicit and unavoidable.
- Use explicit types at public and integration boundaries.
- Use explicit return types for public methods and exported functions.
- Type constructor dependencies explicitly.
- Type external API responses, events, configuration, database results, and queue messages.
- Represent optional and nullable states explicitly.
- Prefer unions and discriminated unions over combinations of ambiguous booleans.
- Preserve generic type information instead of widening values.
- Avoid broad types such as `object`, `Function`, `{}`, and unbounded records.
- Use `Record<string, unknown>` only for genuinely dynamic structures.
- Keep runtime validation separate from compile-time typing.

Prefer inference for obvious local variables when the inferred type is precise.

Avoid redundant annotations:

```typescript
const productName = product.name;
```

Use explicit annotations when they define a contract, prevent widening, or clarify a non-obvious type.

## Interfaces and Type Aliases

Prefer interfaces for:

- Service contracts.
- Repository contracts.
- Dependency boundaries.
- Public object-shaped contracts.
- Components intended to have multiple implementations.

Prefer type aliases for:

- Unions.
- Intersections.
- Mapped types.
- Utility types.
- Function signatures.
- Discriminated unions.
- Primitive aliases.

Example:

```typescript
export interface ProductRepository {
  save(product: Product): Promise<void>;
}

export type ProductStatus = 'active' | 'inactive';

export type ProductResult =
  | { status: 'found'; product: Product }
  | { status: 'missing' };
```

Do not create an interface for every local object when it does not represent a meaningful contract.

## Method Design

Methods should be small, linear, and focused on one responsibility.

Prefer methods that:

- Perform a short sequence of clearly named operations.
- Keep data flow visible from top to bottom.
- Use early returns and guard clauses.
- Return directly after the final operation.
- Delegate implementation details to focused private methods or dependencies.
- Avoid mixing orchestration with low-level implementation details.

The ideal method has a simple linear structure:

```typescript
const response1 = doIt1(params1);
const response2 = doIt2(response1);
const response3 = doIt3(response2);
return response3.toJson();
```

Keep instructions belonging to the same logical sequence together without empty lines between every statement.

Preferred:

```typescript
const product = await this.productRepository.findById(productId);
const price = this.priceCalculator.calculate(product);
const response = this.productMapper.toResponse(product, price);
return response;
```

Avoid:

```typescript
const product = await this.productRepository.findById(productId);

const price = this.priceCalculator.calculate(product);

const response = this.productMapper.toResponse(product, price);

return response;
```

Use an empty line only when it separates genuinely different logical phases.

## Control Flow

Prefer early returns and guard clauses.

Keep nesting as shallow as possible.

Avoid:

```typescript
if (product) {
  if (product.isActive) {
    if (product.price) {
      return this.productMapper.toResponse(product);
    }
  }
}
return null;
```

Prefer:

```typescript
if (!product) {
  return null;
}
if (!product.isActive) {
  return null;
}
if (!product.price) {
  return null;
}
return this.productMapper.toResponse(product);
```

Additional rules:

- Avoid `else` after a branch that already returns or throws.
- Extract complex conditions into clearly named methods or variables.
- Avoid nested ternary expressions.
- Avoid long boolean expressions with unclear intent.
- Avoid callbacks with several nesting levels.
- Prefer sequential orchestration over deeply nested control flow.

## Functions and Responsibilities

Each method should have one clear responsibility.

Extract a method when it:

- Hides a meaningful implementation detail.
- Gives a name to an important business rule.
- Reduces nesting.
- Removes duplication.
- Makes the main workflow easier to read.
- Creates a useful isolated testing boundary.

Do not extract a method that merely renames one obvious expression without improving clarity.

Avoid positional boolean arguments that significantly change behavior.

Avoid:

```typescript
processProduct(product, true, false);
```

Prefer:

```typescript
processProduct(product, {
  validateInventory: true,
  publishChanges: false,
});
```

## Classes and Dependency Injection

Classes should:

- Have one primary responsibility.
- Receive dependencies through the constructor.
- Keep dependencies `private readonly` where appropriate.
- Expose a small public API.
- Keep implementation details private.
- Avoid mutable internal state unless required.
- Avoid service locator patterns.
- Avoid constructing infrastructure dependencies internally.

Avoid:

```typescript
export class ProductService {
  private readonly repository = new DynamoProductRepository();
}
```

Prefer:

```typescript
export class ProductService {
  constructor(private readonly repository: ProductRepository) {}
}
```

Dependencies should expose the smallest contract required by the consumer.

Avoid resolving dependencies from the IoC container inside business methods.

Do not pass a large application context when the class needs only one or two explicit dependencies.

## File Structure

Split a file when it contains multiple independently understandable responsibilities.

Possible extractions include:

- Interfaces.
- DTOs.
- Domain models.
- Mappers.
- Validators.
- Errors.
- Repository implementations.
- Service implementations.
- Test fixtures.

Keep strongly related code together.

Do not split files merely to reduce line count.

Do not create one-line files, unnecessary wrappers, or excessive folder depth.

Follow the existing project's naming and directory conventions.

## Import Ordering

Keep imports clean and visually ordered.

Unless the project already enforces a conflicting import order through ESLint, Prettier, or another formatter, sort import statements by the total length of the complete import statement, from the shortest line to the longest line.

Example:

```typescript
import { Logger } from './logger';
import { Product } from './product';
import { ProductRepository } from './product.repository';
import { ProductResponseMapper } from './product-response.mapper';
```

Required rules:

- The shortest complete import statement must appear first.
- The longest complete import statement must appear last.
- Measure the complete rendered import line, not only the module path.
- Keep each import on one line when it remains readable and compliant with the project's formatter.
- Remove unused imports.
- Merge duplicate imports from the same module when doing so improves clarity.
- Use `import type` for type-only imports when supported by the project and consistent with its conventions.
- Preserve side-effect imports in the position required by runtime behavior or project conventions.
- Do not reorder imports when doing so would change runtime behavior.
- Do not manually fight an existing automated import-ordering rule. When the project has an enforced rule, follow the enforced rule and report the conflict.

After adding or changing imports, re-sort the complete import block.

## Naming

Names should communicate intent and domain meaning.

Prefer names such as:

- `findProductById`
- `isProductAvailable`
- `productRepository`
- `validatedRequest`
- `mappedResponse`

Avoid vague names such as:

- `data`
- `item`
- `obj`
- `temp`
- `handler2`
- `processData`

Generic names such as `result` or `response` are acceptable inside a very small linear method when the meaning is obvious.

Boolean names should normally start with `is`, `has`, `can`, or `should`.

Methods should use verbs. Classes and interfaces should use nouns or role names.

## Error Handling

Preserve the project's established error-handling strategy.

When no clear convention exists:

- Throw explicit errors for exceptional failures.
- Use domain-specific error classes when callers need to distinguish failures.
- Do not catch an error only to throw the same error again.
- Do not silently swallow errors.
- Preserve the original error as `cause` when wrapping it.
- Add useful context when translating infrastructure errors.
- Avoid returning `null` for unexpected technical failures.

Example:

```typescript
try {
  return await this.productRepository.findById(productId);
} catch (error: unknown) {
  throw new ProductReadError(productId, { cause: error });
}
```

Do not wrap every error automatically. Wrap only when adding useful context or translating it into a meaningful application-level error.

## Comments

Prefer expressive code over comments.

Add comments only when they explain:

- A non-obvious business rule.
- An external system limitation.
- A compatibility constraint.
- A deliberate tradeoff.
- A temporary workaround with useful context.

Do not add comments that merely restate the code.

## Refactoring Workflow

Follow this process:

1. Inspect the target code and nearby project conventions.
2. Identify public interfaces and observable behavior that must remain unchanged.
3. Identify typing, readability, nesting, duplication, import, and responsibility problems.
4. Plan the smallest coherent refactoring.
5. Apply changes without altering architecture or public contracts.
6. Split files only where responsibility boundaries become clearer.
7. Sort imports from the shortest complete statement to the longest, unless an enforced project rule conflicts.
8. Run the required verification.
9. Report what changed and what was verified.

Do not combine refactoring with unrelated feature work.

## Required Verification

After refactoring, run all checks relevant to the changed scope:

1. Existing tests.
2. TypeScript compilation or type checking.
3. ESLint.

Use the project's existing scripts and package manager.

Typical examples:

```bash
npm test
npm run build
npm run typecheck
npm run lint
```

Prefer targeted tests during iteration, followed by the broadest practical verification before completion.

Do not claim the refactoring is complete when required checks fail.

When a check cannot be run, clearly state:

- Which check was not run.
- Why it could not be run.
- What risk remains.

## Completion Report

At the end, provide a concise report containing:

- The main readability improvements.
- The main type-safety improvements.
- Any extracted files or responsibilities.
- Confirmation that architecture and public interfaces were preserved.
- Confirmation that imports were cleaned and sorted.
- Test results.
- TypeScript compilation or type-check results.
- ESLint results.
- Any remaining risks or intentionally unchanged issues.

## Definition of Done

The refactoring is complete only when:

- Existing behavior is preserved.
- Public interfaces are unchanged.
- Existing architecture is unchanged.
- The code follows nearby project conventions.
- Types are strict and no new unsafe typing is introduced.
- Methods are small, linear, and minimally nested.
- Related instructions are grouped without unnecessary blank lines.
- Dependencies remain explicit through IoC and dependency injection.
- File boundaries are clearer where splitting was justified.
- Imports are unused-free and sorted from the shortest complete statement to the longest, unless an enforced project rule requires another order.
- Existing tests pass.
- TypeScript compilation or type checking passes.
- ESLint passes.
