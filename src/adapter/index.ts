import {
  callTRPCProcedure,
  TRPCError,
  type AnyRouter,
  type inferRouterContext,
  type ProcedureType,
} from '@trpc/server';
import { isObservable, observableToAsyncIterable } from '@trpc/server/observable';
import { getErrorShape, isAsyncIterable, iteratorResource, run } from '@trpc/server/unstable-core-do-not-import';

import type { TRPCChromeRequest, TRPCChromeResponse } from '../types';
import { getErrorFromUnknown } from './errors';

export type CreateChromeContextOptions = {
  req: chrome.runtime.Port;
  res: undefined;
};

export type CreateChromeHandlerOptions<TRouter extends AnyRouter> = {
  router: TRouter;
  createContext?: (
    opts: CreateChromeContextOptions,
  ) => Promise<inferRouterContext<TRouter>> | inferRouterContext<TRouter>;
  onError?: (opts: {
    error: TRPCError;
    type: ProcedureType | 'unknown';
    path: string | undefined;
    input: unknown;
    ctx: inferRouterContext<TRouter> | undefined;
    req: chrome.runtime.Port;
  }) => void;
};

export const createChromeHandler = <TRouter extends AnyRouter>(
  opts: CreateChromeHandlerOptions<TRouter>,
) => {
  const { router, createContext, onError } = opts;
  const config = router._def._config;
  const { transformer } = config;

  chrome.runtime.onConnect.addListener((port) => {
    const subscriptions = new Map<number | string, AbortController>();
    const listeners: (() => void)[] = [];

    const onDisconnect = () => {
      listeners.forEach((unsub) => unsub());
    };

    port.onDisconnect.addListener(onDisconnect);
    listeners.push(() => port.onDisconnect.removeListener(onDisconnect));

    const onMessage = async (message: TRPCChromeRequest) => {
      if (!('trpc' in message)) return;
      const { trpc } = message;
      if (!('id' in trpc) || trpc.id === null || trpc.id === undefined) return;
      if (!trpc) return;

      const { id, jsonrpc, method } = trpc;

      const sendResponse = (response: TRPCChromeResponse['trpc']) => {
        port.postMessage({
          trpc: { id, jsonrpc, ...response },
        } as TRPCChromeResponse);
      };

      let params: { path: string; input: unknown } | undefined;
      let input: any;
      let ctx: inferRouterContext<TRouter> | undefined;

      try {
        if (method === 'subscription.stop') {
          const subscription = subscriptions.get(id);
          if (subscription) {
            subscription.abort();
            sendResponse({
              result: {
                type: 'stopped',
              },
            });
          }
          subscriptions.delete(id);
          return;
        }

        params = trpc.params;

        input = transformer.input.deserialize(params.input);

        ctx = await createContext?.({ req: port, res: undefined });

        const abortController = new AbortController();
        const result = await callTRPCProcedure({
          router,
          path: params.path,
          getRawInput: async () => input,
          ctx,
          type: method,
          signal: abortController.signal,
          batchIndex: 0,
        });

        if (method !== 'subscription') {
          const data = transformer.output.serialize(result);
          sendResponse({
            result: {
              type: 'data',
              data,
            },
          });
          return;
        }

        if (!isObservable(result) && !isAsyncIterable(result)) {
          throw new TRPCError({
            message: `Subscription ${params.path} did not return an observable`,
            code: 'INTERNAL_SERVER_ERROR',
          });
        }

        const iterable = isObservable(result)
          ? observableToAsyncIterable(result, abortController.signal)
          : result;
        run(async () => {
          await using iterator = iteratorResource(iterable);

          const abortPromise = new Promise<'abort'>((resolve) => {
            abortController.signal.addEventListener('abort', () => {
              resolve('abort');
            });
          });
          while (true) {
            const next = await Promise.race([
              iterator.next().catch(getErrorFromUnknown),
              abortPromise,
            ]);

            if (next === 'abort') {
              iterator.return?.();
              break;
            }

            if (next instanceof Error) {
              const error = getErrorFromUnknown(next);

              onError?.({
                error,
                type: method,
                path: params?.path,
                input,
                ctx,
                req: port,
              });

              sendResponse({
                error: getErrorShape({
                  config,
                  error,
                  type: method,
                  path: params?.path,
                  input,
                  ctx,
                }),
              });

              break;
            }

            if (next.done) {
              sendResponse({
                result: {
                  type: 'stopped',
                },
              });
              break;
            }

            sendResponse({
              result: {
                type: 'data',
                data: transformer.output.serialize(next.value),
              },
            });
          }
        });

        if (subscriptions.has(id)) {
          abortController.abort();
          sendResponse({
            result: {
              type: 'stopped',
            },
          });
          throw new TRPCError({
            message: `Duplicate id ${id}`,
            code: 'BAD_REQUEST',
          });
        }
        listeners.push(() => abortController.abort());

        subscriptions.set(id, abortController);

        sendResponse({
          result: {
            type: 'started',
          },
        });
        return;
      } catch (cause) {
        const error = getErrorFromUnknown(cause);

        onError?.({
          error,
          type: method as ProcedureType,
          path: params?.path,
          input,
          ctx,
          req: port,
        });

        sendResponse({
          error: getErrorShape({
            config,
            error,
            type: method as ProcedureType,
            path: params?.path,
            input,
            ctx,
          }),
        });
      }
    };

    port.onMessage.addListener(onMessage);
    listeners.push(() => port.onMessage.removeListener(onMessage));
  });
};
