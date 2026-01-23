---
trigger: always_on
---

Component Props Typing — Mandatory `Props` for Single Type Files

When defining a React/Next.js component with props, if the file contains **only one non-exported type**, it **MUST** be named exactly `TProps`.

Example:
For this component:

"""tsx
function Button({ name, onClick, another }) {
// ...
}
"""

You MUST define props like this:
"""tsx
type Props = {
name: string;
onClick?: () => void;
another?: any;
};

export function Button({ name, onClick, another }: Props) {
// ...
}
"""
Key points:

- TProps is always used if there’s only one type in the file.
- TProps must not be exported — it is local to the component file.
- Props must be explicitly typed — never leave props untyped or inline-typed.
- Follow camelCase naming for properties inside TProps, but the type name itself must be TProps.

This ensures consistent, clear, and easy-to-find component prop typings across the codebase.
