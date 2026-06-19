# Utils Directory

This directory contains utility functions, helpers, and non-React component code.

## Expo Router Warnings

You may see warnings about missing default exports for files in this directory. **These warnings are expected and harmless.** 

Expo Router checks all files in the `app/` directory for potential routes. Since these are utility files (not React components), they don't need default exports. The warnings don't affect functionality.

### Files That May Show Warnings

- Type definitions (`*.ts` files without default exports)
- Utility functions (`*.ts` files with named exports only)
- Helper modules
- Configuration files

These warnings can be safely ignored.
