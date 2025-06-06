# memoize

> [Memoize](https://en.wikipedia.org/wiki/Memoization) functions - An optimization used to speed up consecutive function calls by caching the result of calls with identical input

Memory is automatically released when an item expires or the cache is cleared.

<!-- Please keep this section in sync with https://github.com/sindresorhus/p-memoize/blob/main/readme.md -->

By default, **only the memoized function's first argument is considered** via strict equality comparison. If you need to cache multiple arguments or cache `object`s *by value*, have a look at alternative [caching strategies](#caching-strategy) below.

If you want to memoize Promise-returning functions (like `async` functions), you might be better served by [p-memoize](https://github.com/sindresorhus/p-memoize).

## Install

```sh
npm install memoize
```

## Usage

```js
import memoize from 'memoize';

let index = 0;
const counter = () => ++index;
const memoized = memoize(counter);

memoized('foo');
//=> 1

// Cached as it's the same argument
memoized('foo');
//=> 1

// Not cached anymore as the argument changed
memoized('bar');
//=> 2

memoized('bar');
//=> 2

// Only the first argument is considered by default
memoized('bar', 'foo');
//=> 2
```

##### Works well with Promise-returning functions

But you might want to use [p-memoize](https://github.com/sindresorhus/p-memoize) for more Promise-specific behaviors.

```js
import memoize from 'memoize';

let index = 0;
const counter = async () => ++index;
const memoized = memoize(counter);

console.log(await memoized());
//=> 1

// The return value didn't increase as it's cached
console.log(await memoized());
//=> 1
```

```js
import memoize from 'memoize';
import got from 'got';
import delay from 'delay';

const memoizedGot = memoize(got, {maxAge: 1000});

await memoizedGot('https://sindresorhus.com');

// This call is cached
await memoizedGot('https://sindresorhus.com');

await delay(2000);

// This call is not cached as the cache has expired
await memoizedGot('https://sindresorhus.com');
```

### Caching strategy

By default, only the first argument is compared via exact equality (`===`) to determine whether a call is identical.

```js
import memoize from 'memoize';

const pow = memoize((a, b) => Math.pow(a, b));

pow(2, 2); // => 4, stored in cache with the key 2 (number)
pow(2, 3); // => 4, retrieved from cache at key 2 (number), it's wrong
```

You will have to use the `cache` and `cacheKey` options appropriate to your function. In this specific case, the following could work:

```js
import memoize from 'memoize';

const pow = memoize((a, b) => Math.pow(a, b), {
  cacheKey: arguments_ => arguments_.join(',')
});

pow(2, 2); // => 4, stored in cache with the key '2,2' (both arguments as one string)
pow(2, 3); // => 8, stored in cache with the key '2,3'
```

More advanced examples follow.

#### Example: Options-like argument

If your function accepts an object, it won't be memoized out of the box:

```js
import memoize from 'memoize';

const heavyMemoizedOperation = memoize(heavyOperation);

heavyMemoizedOperation({full: true}); // Stored in cache with the object as key
heavyMemoizedOperation({full: true}); // Stored in cache with the object as key, again
// The objects appear the same, but in JavaScript, they're different objects
```

You might want to serialize or hash them, for example using `JSON.stringify` or something like [serialize-javascript](https://github.com/yahoo/serialize-javascript), which can also serialize `RegExp`, `Date` and so on.

```js
import memoize from 'memoize';

const heavyMemoizedOperation = memoize(heavyOperation, {cacheKey: JSON.stringify});

heavyMemoizedOperation({full: true}); // Stored in cache with the key '[{"full":true}]' (string)
heavyMemoizedOperation({full: true}); // Retrieved from cache
```

The same solution also works if it accepts multiple serializable objects:

```js
import memoize from 'memoize';

const heavyMemoizedOperation = memoize(heavyOperation, {cacheKey: JSON.stringify});

heavyMemoizedOperation('hello', {full: true}); // Stored in cache with the key '["hello",{"full":true}]' (string)
heavyMemoizedOperation('hello', {full: true}); // Retrieved from cache
```

#### Example: Multiple non-serializable arguments

If your function accepts multiple arguments that aren't supported by `JSON.stringify` (e.g. DOM elements and functions), you can instead extend the initial exact equality (`===`) to work on multiple arguments using [`many-keys-map`](https://github.com/fregante/many-keys-map):

```js
import memoize from 'memoize';
import ManyKeysMap from 'many-keys-map';

const addListener = (emitter, eventName, listener) => emitter.on(eventName, listener);

const addOneListener = memoize(addListener, {
	cacheKey: arguments_ => arguments_, // Use *all* the arguments as key
	cache: new ManyKeysMap() // Correctly handles all the arguments for exact equality
});

addOneListener(header, 'click', console.log); // `addListener` is run, and it's cached with the `arguments` array as key
addOneListener(header, 'click', console.log); // `addListener` is not run again because the arguments are the same
addOneListener(mainContent, 'load', console.log); // `addListener` is run, and it's cached with the `arguments` array as key
```

Better yet, if your function’s arguments are compatible with `WeakMap`, you should use [`deep-weak-map`](https://github.com/futpib/deep-weak-map) instead of `many-keys-map`. This will help avoid memory leaks.

## API

### memoize(fn, options?)

#### fn

Type: `Function`

The function to be memoized.

#### options

Type: `object`

##### maxAge

Type: `number` | `Function`\
Default: `Infinity`\
Example: `arguments_ => arguments_ < new Date() ? Infinity : 60_000`

Milliseconds until the cache entry expires.

If a function is provided, it receives the arguments and must return the max age.

##### cacheKey

Type: `Function`\
Default: `arguments_ => arguments_[0]`\
Example: `arguments_ => JSON.stringify(arguments_)`

Determines the cache key for storing the result based on the function arguments. By default, **only the first argument is considered**.

A `cacheKey` function can return any type supported by `Map` (or whatever structure you use in the `cache` option).

Refer to the [caching strategies](#caching-strategy) section for more information.

##### cache

Type: `object`\
Default: `new Map()`

Use a different cache storage. Must implement the following methods: `.has(key)`, `.get(key)`, `.set(key, value)`, `.delete(key)`, and optionally `.clear()`. You could for example use a `WeakMap` instead or [`quick-lru`](https://github.com/sindresorhus/quick-lru) for a LRU cache.

Refer to the [caching strategies](#caching-strategy) section for more information.

### memoizeDecorator(options)

Returns a [decorator](https://github.com/tc39/proposal-decorators) to memoize class methods or static class methods.

Notes:

- Only class methods and getters/setters can be memoized, not regular functions (they aren't part of the proposal);
- Only [TypeScript’s decorators](https://www.typescriptlang.org/docs/handbook/decorators.html#parameter-decorators) are supported, not [Babel’s](https://babeljs.io/docs/en/babel-plugin-proposal-decorators), which use a different version of the proposal;
- Being an experimental feature, they need to be enabled with `--experimentalDecorators`; follow TypeScript’s docs.

#### options

Type: `object`

Same as options for `memoize()`.

```ts
import {memoizeDecorator} from 'memoize';

class Example {
	index = 0

	@memoizeDecorator()
	counter() {
		return ++this.index;
	}
}

class ExampleWithOptions {
	index = 0

	@memoizeDecorator({maxAge: 1000})
	counter() {
		return ++this.index;
	}
}
```

### memoizeClear(fn)

Clear all cached data of a memoized function.

#### fn

Type: `Function`

The memoized function.

## Tips

### Cache statistics

If you want to know how many times your cache had a hit or a miss, you can make use of [stats-map](https://github.com/SamVerschueren/stats-map) as a replacement for the default cache.

#### Example

```js
import memoize from 'memoize';
import StatsMap from 'stats-map';
import got from 'got';

const cache = new StatsMap();
const memoizedGot = memoize(got, {cache});

await memoizedGot('https://sindresorhus.com');
await memoizedGot('https://sindresorhus.com');
await memoizedGot('https://sindresorhus.com');

console.log(cache.stats);
//=> {hits: 2, misses: 1}
```

## Related

- [p-memoize](https://github.com/sindresorhus/p-memoize) - Memoize promise-returning & async functions
