# Contributing to remix-cloudflare

Thank you for your interest in contributing to `remix-cloudflare`! We welcome contributions, bug reports, and suggestions from the community.

## Development Setup

1. Fork and clone the repository:
   ```sh
   git clone https://github.com/bennyhinn18/remix-cloudflare.git
   cd remix-cloudflare
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Build the library:
   ```sh
   npm run build
   ```

4. Typecheck:
   ```sh
   npm run typecheck
   ```

## Pull Request Guidelines

- Ensure your code passes TypeScript checks (`npm run typecheck`).
- Follow clear, readable code conventions.
- Keep dependencies minimal to preserve zero runtime overhead for edge deployments.
