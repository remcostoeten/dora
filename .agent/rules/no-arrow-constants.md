---
trigger: always_on
---

RULE: Function Declarations Only

The codebase must not contain arrow functions.

Disallow:
- const fn = () => {}
- export const fn = () => {}
- use of => in any form

Allow only:
- function fn() {}
- export function fn() {}

Enforcement:
- If any arrow function is detected, reject the output.
- Rewrite all arrow functions into standard function declarations.
- Do not introduce arrow functions in new code.
- Do not suggest arrow functions in examples or explanations.

Rationale:
- Enforce consistent style.
- Improve stack traces and debugging.
- Avoid lexical this and implicit returns.

Compliance check:
- Scan for "=>" before returning any code.
- If found, block the response and regenerate using function declarations only.
