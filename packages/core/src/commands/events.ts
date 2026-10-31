import type { EventName, Row, TableEvents } from '../types';
import { errorOf, freeze } from '../utils/immutable';
export function createEventBus<TRow extends object = Row>(
  onError: (error: Error) => void,
): {
  on: <E extends EventName>(name: E, handler: (event: TableEvents<TRow>[E]) => void) => () => void;
  emit: <E extends EventName>(name: E, event: TableEvents<TRow>[E]) => void;
  clear: () => void;
  has: (name: EventName) => boolean;
} {
  const handlers = new Map<EventName, Set<(event: never) => void>>();
  return {
    has: (name) => (handlers.get(name)?.size ?? 0) > 0,
    on(name, handler) {
      const set = handlers.get(name) ?? new Set();
      set.add(handler);
      handlers.set(name, set);
      return () => {
        set.delete(handler);
      };
    },
    emit(name, event) {
      const snapshot = freeze(event);
      for (const handler of handlers.get(name) ?? []) {
        try {
          handler(snapshot as never);
        } catch (error) {
          onError(errorOf(error));
        }
      }
    },
    clear() {
      handlers.clear();
    },
  };
}
