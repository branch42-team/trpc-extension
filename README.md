![trpc-chrome](assets/trpc-chrome-readme.png)

<div align="center">
  <h1>trpc-extension</h1>
  <a href="https://www.npmjs.com/package/trpc-extension"><img src="https://img.shields.io/npm/v/trpc-extension.svg?style=flat&color=brightgreen" target="_blank" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-black" /></a>
  <a href="https://trpc.io/discord" target="_blank"><img src="https://img.shields.io/badge/chat-discord-blue.svg" /></a>
  <br />
  <hr />
</div>

## **[Chrome extension](https://developer.chrome.com/docs/extensions/mv3/) support for [tRPC](https://trpc.io/)** 🧩

- Easy communication for web extensions.
- Typesafe messaging between content & background scripts.
- Ready for Manifest V3.

## Usage

**1. Install `trpc-extension`.**

```bash
# npm
npm install trpc-extension
# pnpm
pnpm add trpc-extension
# yarn
yarn add trpc-extension
```

**2. Add `createChromeHandler` in your background script.**

```typescript
// background.ts
import { initTRPC } from '@trpc/server';
import { createChromeHandler } from 'trpc-extension/adapter';

const t = initTRPC.create({
  isServer: false,
  allowOutsideOfServer: true,
});

const appRouter = t.router({
  // ...procedures
});

export type AppRouter = typeof appRouter;

createChromeHandler({
  router: appRouter /* 👈 */,
});
```

**3. Add a `chromeLink` to the client in your content script.**

```typescript
// content.ts
import { createTRPCClient } from '@trpc/client';
import { chromeLink } from 'trpc-extension/link';

import type { AppRouter } from './background';

const port = chrome.runtime.connect();
export const chromeClient = createTRPCClient<AppRouter>({
  links: [/* 👉 */ chromeLink({ port })],
});
```

## Requirements

Peer dependencies:

- [`tRPC`](https://github.com/trpc/trpc) Server v11 (`@trpc/server`) must be installed.
- [`tRPC`](https://github.com/trpc/trpc) Client v11 (`@trpc/client`) must be installed.

## Example

Please see [full example here](examples/with-plasmo).

_For advanced use-cases, please find examples in our [complete test suite](test)._

## Types

#### ChromeLinkOptions

Please see [full typings here](src/link/index.ts).

| Property | Type                  | Description                                                      | Required |
| -------- | --------------------- | ---------------------------------------------------------------- | -------- |
| `port`   | `chrome.runtime.Port` | An open web extension port between content & background scripts. | `true`   |

#### CreateChromeHandlerOptions

Please see [full typings here](src/adapter/index.ts).

| Property        | Type       | Description                                            | Required |
| --------------- | ---------- | ------------------------------------------------------ | -------- |
| `router`        | `Router`   | Your application tRPC router.                          | `true`   |
| `createContext` | `Function` | Passes contextual (`ctx`) data to procedure resolvers. | `false`  |
| `onError`       | `Function` | Called if error occurs inside handler.                 | `false`  |

---

## License

Distributed under the MIT License. See LICENSE for more information.

## Contact

Forked and upgrade by Parth V (Branch42 labs)
James Berry - Follow me on Twitter [@jlalmes](https://twitter.com/jlalmes) 💙
