# AI Development Guidelines

## Core Expectations
- Prioritize correctness, maintainability, and predictable behavior.
- Prefer clear, readable, testable code over clever or overly compact code.
- Fix root causes instead of masking symptoms.
- Preserve existing behavior unless a change is explicitly required.
- If requirements are unclear, state assumptions or ask for clarification before making risky changes.

## Avoid Fragile Fixes
- Do not use hacky workarounds such as random delays, timing-based fixes, magic numbers, or broad suppressions to hide the real problem.
- Prefer solutions that restore the correct invariant at the right layer.
- If a workaround is unavoidable:
  - isolate it to the smallest possible surface,
  - document why it exists,
  - describe when it can be removed,
  - reference an issue if one exists.

## Type Safety (when applicable)
- Do not use `any`, unsafe casts, `@ts-ignore`, or broad lint disables unless there is no reasonable alternative.
- Contain unsafe boundaries in small adapter modules.
- Validate and normalize external or untyped data before exposing typed values.
- Prefer explicit types, guards, discriminated unions, generics, `satisfies`, and `as const` over loose typing.
- Model domain states explicitly instead of relying on implicit `undefined` or loosely shaped objects.

## Design Principles
- Keep modules cohesive: one clear responsibility per module, class, hook, or function.
- Prefer extension over risky modification of stable behavior.
- Depend on abstractions where it improves testability or reduces coupling.
- Avoid circular dependencies.
- Reuse established patterns in the codebase unless there is a strong reason to introduce a new one.
- Separate orchestration, domain logic, I/O, and UI concerns whenever practical.

## Maintainability Rules
- Optimize for clarity over cleverness.
- Keep public APIs small, explicit, and focused.
- If code is hard to understand, improve the structure first; add comments only where behavior is non-obvious.
- Prefer small, composable units over large multi-purpose modules.
- Make error handling explicit; do not silently swallow failures.

## Dependencies and Third-Party Libraries
- Do not guess how a library works if the behavior matters.
- Check official documentation, typings, and implementation details when needed.
- Keep third-party quirks inside local adapters or wrappers instead of spreading them across the codebase.
- Prefer small integration boundaries that are easy to replace or test.

## Performance and Correctness
- Prefer deterministic behavior over timing-sensitive behavior.
- Avoid unnecessary work, re-computation, and hidden side effects.
- Use memoization, caching, or batching only when it has a clear benefit and does not reduce correctness.
- Keep logs actionable and avoid noisy or redundant logging.

## Testing and Validation
- Add or update tests when behavior changes, especially around edge cases and regressions.
- Verify both success and failure paths.
- Keep business logic testable outside framework-specific runtime when possible.
- Avoid introducing code that cannot be validated reasonably.

## Collaboration Expectations
- Operate like a senior engineer: prioritize long-term maintainability, architecture, and reliability.
- If there is a better approach, propose it with clear trade-offs.
- Push back on changes that are likely to create technical debt, but provide a practical alternative.
- Preserve useful existing comments; remove or update obsolete ones.
- Add concise comments only where they improve understanding of non-obvious behavior.

## Practical Checklist Before Finalizing
- Is the root cause addressed?
- Is the solution easy to understand and maintain?
- Are unsafe boundaries isolated?
- Are responsibilities separated appropriately?
- Are error cases handled explicitly?
- Are tests or validations updated if needed?
