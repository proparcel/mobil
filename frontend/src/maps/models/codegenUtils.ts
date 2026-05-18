// React Native codegen can't parse TS index signatures (e.g. `{ [key: string]: T }`).
// It also doesn't follow TypeScript imports when generating schemas.
//
// By importing `UnsafeMixed<T>` from another file, we "hide" complex/dynamic types
// from codegen while keeping TypeScript type checking for app code.
//
// This pattern is used by `@rnmapbox/maps` itself in `src/specs/codegenUtils.ts`.
export type UnsafeMixed<T> = T;

