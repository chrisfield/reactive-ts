const context: Array<Effect> = [];

export interface BaseOptions {
  name?: string;
}

export interface EffectOptions extends BaseOptions {}

export interface MemoOptions<T> extends EffectOptions {
  equals?: false | ((prev: T, next: T) => boolean);
}

export type Accessor<T> = () => T;

export type Setter<T> = (undefined extends T ? () => undefined : {}) &
  (<U extends T>(value: (prev: T) => U) => U) &
  (<U extends T>(value: Exclude<U, Function>) => U) &
  (<U extends T>(value: Exclude<U, Function> | ((prev: T) => U)) => U);

export type Signal<T> = [get: Accessor<T>, set: Setter<T>];

export interface SignalState<T> {
  value?: T;
  observers: Set<Effect>;
}

type Effect = {
  execute: () => void;
  dependencies: Set<Set<Effect>>;
};

function subscribe(running: Effect, subscriptions: Set<Effect>) {
  subscriptions.add(running);
  running.dependencies.add(subscriptions);
}

export function createSignal<T>(): Signal<T | undefined>;
export function createSignal<T>(value: T): Signal<T>;
export function createSignal<T>(value?: T): Signal<T | undefined> {
  const s: SignalState<T> = {
    value,
    observers: new Set(),
  };

  const subscriptions: Set<Effect> = new Set();

  const read = () => {
    const running = context[context.length - 1];
    if (running) subscribe(running, subscriptions);
    return s.value;
  };

  const setter: Setter<T | undefined> = (value?: unknown) => {
    s.value = value as any;
    s.observers = subscriptions;

    for (const sub of [...subscriptions]) {
      sub.execute();
    }
    return undefined;
  };

  return [readSignal.bind(s), setter];
}

export function readSignal(this: SignalState<any>) {
  const running = context[context.length - 1];
  if (running) subscribe(running, this.observers);
  return this.value;
}

function cleanup(running: Effect) {
  for (const dep of running.dependencies) {
    dep.delete(running);
  }
  running.dependencies.clear();
}

export function createEffect(fn: () => void) {
  const execute = () => {
    cleanup(running);
    context.push(running);
    try {
      fn();
    } finally {
      context.pop();
    }
  };

  const running: Effect = {
    execute,
    dependencies: new Set(),
  };

  execute();
}

export function createMemo(fn: () => any) {
  const [s, set] = createSignal(null);
  createEffect(() => set(fn()));
  return s;
}
