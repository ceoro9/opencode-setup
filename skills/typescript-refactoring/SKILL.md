---
name: typescript-refactoring
description: Refactor existing TypeScript code without changing its architecture, public contracts, business behaviour, or external interfaces. Use for strict typing, clearer class-based design, IoC and constructor injection, smaller linear methods, minimal nesting, explicit access modifiers and return types, compact logical whitespace, focused file boundaries, and imports sorted by statement length. Validate changes with existing tests, TypeScript compilation or type checking, and ESLint.
compatibility: opencode
metadata:
  language: typescript
  category: refactoring
---

# TypeScript Refactoring

Refactor TypeScript code to make it stricter, clearer, and easier to maintain while preserving its behaviour, architecture, and public interfaces.

## Priorities

Apply these priorities in order:

1. Preserve behaviour, public contracts, and architecture.
2. Follow established project conventions when they remain readable and type-safe.
3. Improve readability and maintainability.
4. Strengthen TypeScript typing.
5. Prefer classes, interfaces, IoC, and constructor-based dependency injection.
6. Make the smallest complete change.

Do not redesign the application, introduce a new framework, or perform unrelated cleanup during a refactoring task.

The explicit formatting rules in this skill are the desired target style. Existing automated ESLint or formatter rules take precedence when they conflict, because the resulting code must pass project checks.

## Allowed Scope

You may:

- Improve types, naming, readability, and control flow.
- Reduce nesting and duplication.
- Extract small focused methods.
- Split large files by responsibility.
- Extract interfaces and implementation contracts.
- Improve existing dependency-injection boundaries.
- Reorganise private implementation details.
- Clean, merge, and reorder imports.
- Update tests when required to preserve existing behaviour.

You must not:

- Change application architecture.
- Change public APIs, exported contracts, or observable behaviour.
- Change business rules.
- Rename public methods, DTO properties, event fields, configuration keys, API fields, or persistence fields.
- Add unrelated features or abstractions.
- Add, replace, or upgrade dependencies unless explicitly requested.
- Expand the refactoring beyond the requested area without a correctness reason.

## Inspect Before Refactoring

Before changing code:

1. Inspect the target file and nearby related files.
2. Identify project conventions for naming, structure, typing, dependency injection, errors, imports, and tests.
3. Identify public contracts and behaviour that must remain unchanged.
4. Reuse existing utilities and abstractions instead of creating parallel ones.
5. Plan the smallest coherent refactoring.

When no clear project convention exists, follow this skill.

## Architecture and Dependency Injection

Prefer object-oriented TypeScript with:

- Classes for services, use cases, handlers, repositories, mappers, and infrastructure implementations.
- Interfaces for contracts and dependency boundaries.
- Constructor-based dependency injection.
- IoC registration when the project already uses an IoC container.
- Dependencies directed towards abstractions rather than concrete infrastructure implementations.

```typescript
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
}

export class GetProduct {
  public constructor(private readonly productRepository: ProductRepository) {}

  public async execute(id: string): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id);
    }
    return product;
  }
}
```

Do not:

- Introduce a new IoC framework when the project does not already use one.
- Resolve dependencies from a container inside business methods.
- Construct infrastructure dependencies inside consumers when they can be injected.
- Pass a large application context when a class needs only a few explicit dependencies.
- Reorganise modules or layers only to enforce Clean Architecture terminology.

## Strict Type Safety

Use the strictest practical TypeScript typing.

Required rules:

- Do not introduce `any`.
- Replace existing `any` when its real type can be determined within scope.
- Use `unknown` for genuinely unknown values and narrow it before use.
- Avoid type assertions unless a runtime guarantee has been established.
- Never use double assertions such as `value as unknown as SomeType`.
- Avoid non-null assertions unless the invariant is explicit and unavoidable.
- Type public boundaries, constructor dependencies, API responses, events, configuration, database results, and queue messages explicitly.
- Represent optional and nullable states explicitly.
- Preserve generic information instead of widening values.
- Prefer unions and discriminated unions over ambiguous boolean combinations.
- Avoid broad types such as `object`, `Function`, `{}`, and unbounded records.
- Use `Record<string, unknown>` only for genuinely dynamic structures.
- Keep runtime validation separate from compile-time typing.

Prefer inference for obvious local variables when the inferred type is precise. Do not add annotations that merely repeat the compiler.

## Interfaces and Type Aliases

Prefer interfaces for:

- Service and repository contracts.
- Dependency boundaries.
- Public object-shaped contracts.
- Components intended to have multiple implementations.

Prefer type aliases for:

- Unions and intersections.
- Mapped and utility types.
- Function signatures.
- Discriminated unions.
- Primitive aliases.

Do not create an interface for every local object when it does not represent a meaningful contract.

## Class Member Declarations

Every class constructor and method must declare an explicit access modifier:

- `public`
- `protected`
- `private`

Every regular method and getter must declare an explicit return type, including `Promise<void>` and `void`.

Constructors and setters are TypeScript language exceptions and do not declare return types.

Required:

```typescript
export class ProductService {
  public constructor(private readonly productRepository: ProductRepository) {}

  public async findProduct(id: string): Promise<Product | null> {
    return this.productRepository.findById(id);
  }

  private mapProduct(product: Product): ProductModel {
    return mapProductToModel(product);
  }
}
```

Avoid relying on implicit `public` or inferred method return types.

## Method Design

Methods should be small, linear, and focused on one responsibility.

Prefer:

- Early returns and guard clauses.
- Minimal nesting.
- A visible top-to-bottom data flow.
- Small orchestration methods that delegate details to focused methods or dependencies.
- Direct returns after the final operation.

Ideal compact method:

```typescript
const response1 = doIt1(params1);
const response2 = doIt2(response1);
const response3 = doIt3(response2);
return response3.toJson();
```

Avoid:

- `else` after a branch that already returns or throws.
- Nested ternary expressions.
- Deeply nested callbacks or conditionals.
- Long boolean expressions with unclear intent.
- Methods that mix orchestration, validation, persistence, mapping, and infrastructure details without clear structure.
- Positional boolean arguments whose meaning is unclear.

Extract a method only when it names a meaningful rule, reduces nesting or duplication, hides a useful implementation detail, or creates a valuable testing boundary.

## Blank Lines Inside Methods

Do not add decorative or automatic blank lines. Blank lines must communicate logical structure.

### Short methods

A short method with a single linear flow should contain no blank lines between its instructions, even when it includes a local variable, validation, database call, and return.

```typescript
public async getState(countryCode: string): Promise<SitesStateModel> {
  const normalisedCountryCode = countryCode.toUpperCase();
  this.validateCountryCode(normalisedCountryCode);
  const row = await this.sitesStateRepository.findState(normalisedCountryCode);
  return mapSitesStateRowToModel(row);
}
```

Do not format the same method like this:

```typescript
public async getState(countryCode: string): Promise<SitesStateModel> {
  const normalisedCountryCode = countryCode.toUpperCase();

  this.validateCountryCode(normalisedCountryCode);

  const row = await this.sitesStateRepository.findState(normalisedCountryCode);

  return mapSitesStateRowToModel(row);
}
```

### Longer methods

In a longer method, use one blank line only to separate meaningful groups of related instructions.

Typical groups include:

- Local values and input preparation.
- Validation and guard clauses.
- Database or external-service operations.
- Mapping or response construction.
- Final return.

```typescript
public async updateProduct(command: UpdateProductCommand): Promise<ProductModel> {
  const productId = ProductId.from(command.productId);
  const productName = ProductName.from(command.name);
  const updatedAt = this.clock.now();

  this.validateCommand(command);
  await this.permissionsService.assertCanUpdate(command.actorId, productId);

  const product = await this.productRepository.findRequired(productId);
  const category = await this.categoryRepository.findRequired(command.categoryId);

  product.update(productName, category, updatedAt);
  await this.productRepository.save(product);

  return this.productMapper.toModel(product);
}
```

Do not force a blank line before `return` in a short method. Add one only when the return follows a distinct multi-line logical phase and the separation improves readability.

Never place blank lines between individual instructions that belong to the same operation.

## Compact Class Style

Use compact whitespace for short service methods:

```typescript
@Injectable()
export class SitesStateService {
  public constructor(private readonly sitesStateRepository: SitesStateRepository) {}

  public async getStatesByCountry(countryCode: string): Promise<SitesStateModel[]> {
    try {
      const rows = await this.sitesStateRepository.findStatesByCountry(countryCode);
      return rows.map(mapSitesStateRowToModel);
    } catch {
      throw new Error(REPOSITORY_ERROR_MESSAGE);
    }
  }

  public async getStatesByRegionCountry(region: string, countryCode: string): Promise<SitesStateModel[]> {
    try {
      const rows = await this.sitesStateRepository.findStatesByRegionCountry(region, countryCode);
      return rows.map(mapSitesStateRowToModel);
    } catch {
      throw new Error(REPOSITORY_ERROR_MESSAGE);
    }
  }
}
```

Keep one blank line between class members. Do not add blank lines inside these short methods.

## Import Formatting and Ordering

Keep all regular import statements in one compact block with no blank lines between them.

Unless an enforced project rule requires another order, sort imports by the character length of the complete import statement from shortest to longest.

```typescript
import { Pool, PoolConfig } from 'pg';
import { Signer } from '@aws-sdk/rds-signer';
import { Kysely, PostgresDialect } from 'kysely';
import { ConfigService } from '@datagraph/shared';
import { SitesDatabase } from './sites-database.type';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AppConfig, ConfigKeysEnum, SitesDatabaseConfig } from '../../common';
```

Required rules:

- Do not separate external, internal, relative, value, or type imports with blank lines.
- Measure the complete rendered statement, not only the module path.
- Keep imports on one line when allowed by the formatter and line-length rules.
- Remove unused imports.
- Merge duplicate imports from the same module when appropriate.
- Use `import type` when supported and consistent with the project.
- Preserve side-effect import order when runtime behaviour depends on it.
- Re-sort the complete import block after adding, removing, or changing imports.
- Follow enforced ESLint or formatter ordering when it conflicts with this convention, and mention the conflict in the completion report.

## File Structure

Split a file when it contains multiple independently understandable responsibilities, such as:

- Contracts or interfaces.
- DTOs and types.
- Domain models.
- Mappers and validators.
- Errors.
- Repository or service implementations.
- Test fixtures.

Keep strongly related code together. Do not split files merely to reduce line count, create one-line wrappers, or add excessive folder depth.

Follow the existing naming and directory conventions.

## Naming

Use names that express domain intent.

Prefer:

- `findProductById`
- `isProductAvailable`
- `productRepository`
- `validatedRequest`
- `mappedResponse`

Avoid vague names such as `data`, `item`, `obj`, `temp`, `handler2`, or `processData` when a more precise name is available.

Generic names such as `result`, `rows`, or `response` are acceptable in very small methods when their meaning is obvious.

Boolean names should normally start with `is`, `has`, `can`, or `should`. Methods should use verbs; classes and interfaces should use nouns or role names.

## Error Handling

Preserve the project's established error-handling strategy.

Do not:

- Silently swallow errors.
- Catch an error only to throw the same error unchanged.
- Wrap every error without adding useful context.
- Return `null` for unexpected technical failures unless this is an established contract.

When wrapping an error, preserve it as `cause` when supported and consistent with the project.

## Comments

Prefer expressive code over comments.

Add comments only for non-obvious business rules, external limitations, compatibility constraints, deliberate trade-offs, or temporary workarounds with useful context.

Do not add comments that merely restate the code.

## Refactoring Workflow

1. Inspect the target code and nearby conventions.
2. Identify behaviour, architecture, and public contracts that must remain unchanged.
3. Identify typing, readability, nesting, whitespace, import, and responsibility problems.
4. Apply the smallest coherent refactoring.
5. Keep methods linear and blank lines intentional.
6. Add explicit access modifiers and return types.
7. Clean and sort imports.
8. Run the required checks.
9. Report changes, verification results, and remaining risks.

Do not combine refactoring with unrelated feature work.

## Required Verification

Run all checks relevant to the changed scope:

1. Existing tests.
2. TypeScript compilation or type checking.
3. ESLint.

Use the project's existing package manager and scripts, for example:

```bash
npm test
npm run build
npm run typecheck
npm run lint
```

Prefer targeted checks during iteration, followed by the broadest practical verification before completion.

Do not claim completion when required checks fail. When a check cannot be run, state which check was skipped, why, and what risk remains.

## Completion Report

Provide a concise report containing:

- Main readability and type-safety improvements.
- Extracted files or responsibilities, if any.
- Confirmation that architecture, public interfaces, and behaviour were preserved.
- Confirmation that access modifiers, return types, whitespace, and imports were checked.
- Test, compilation or type-check, and ESLint results.
- Remaining risks or intentionally unchanged issues.

## Definition of Done

The refactoring is complete only when:

- Existing behaviour is preserved.
- Public interfaces and architecture are unchanged.
- Nearby project conventions are respected.
- No new unsafe typing is introduced.
- Class constructors and methods have explicit access modifiers.
- Methods and getters have explicit return types.
- Methods are small, linear, and minimally nested.
- Short methods contain no unnecessary blank lines.
- Longer methods use blank lines only between logical groups.
- Imports contain no unnecessary blank lines and are sorted from shortest to longest unless tooling enforces another order.
- Existing tests pass.
- TypeScript compilation or type checking passes.
- ESLint passes.
