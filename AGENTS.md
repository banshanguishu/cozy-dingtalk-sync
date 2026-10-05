# Repository Guidelines

## Project Structure & Module Organization

This repository is a Node.js Shopify-to-DingTalk sync service. The one-shot sync entry is `index.js`; scheduled execution starts from `scheduler.js`. Core modules live in `src/`: Shopify API access in `shopifyClient.js`, DingTalk delivery in `dingtalkClient.js`, order shaping in `buildOrders.js`, state/file helpers, and product mapping in `src/mapping/collectionMap.js`.

Operational scripts are in `scripts/` for single-order tests, refund sync checks, history sync, and manual DingTalk pushes. Example payloads and schemas are in `seed/`. Runtime output is written to `output/` and logs to `logs/`; these should be treated as generated artifacts.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm start`: run `scheduler.js` and start periodic order/refund synchronization.
- `node index.js`: run a normal incremental order sync once.
- `node index.js refund`: run a refund sync once.
- `node scripts/test_single_order_sync.js`: smoke-test a single order flow.
- `node scripts/test_refund_sync.js`: smoke-test refund handling.

`npm test` is currently a placeholder that exits with an error, so use the script-level smoke checks until a formal test suite is added.

## Coding Style & Naming Conventions

Use CommonJS (`require`, `module.exports`) with the existing two-space indentation and semicolon style. Prefer `const` for stable bindings and `let` only for mutable cursor state. File names use lower camel case, such as `shopifyClient.js`; constants use upper snake case, such as `COLLECTION_MAP`.

Keep order transformations in `src/buildOrders.js`, external API calls in client modules, and runtime configuration validation in `src/configValidator.js`. Avoid mixing generated output or local cursor files into source changes.

## Testing Guidelines

There is no dedicated test framework or coverage target yet. For behavior changes, run the smallest relevant smoke script and, when possible, a one-shot sync against `.env.test.local` or another safe test configuration. Name new validation scripts with a `test_*.js` prefix under `scripts/`.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits, often with scopes: `feat(hardware): ...`, `refactor(buildOrders): ...`, `chore(seed): ...`, `docs: ...`. Keep subjects concise and behavior-focused.

Pull requests should include the sync type affected, smoke-check output or logs, and any required `.env.example` changes. Include screenshots only when DingTalk table output is easier to verify visually.

## Security & Configuration Tips

Do not commit `.env`, `.env.test.local`, webhook files, API tokens, generated logs, or `output/` data. Update `.env.example` when adding required configuration, and validate new runtime settings through `src/configValidator.js`.
