import test from 'ava';
import delay from 'delay';
import serializeJavascript from 'serialize-javascript';
import memoize, {memoizeDecorator, memoizeClear} from './index.js';

test('memoize', t => {
	let index = 0;
	const fixture = (a?: unknown, b?: unknown) => index++;
	const memoized = memoize(fixture);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(undefined), 0);
	t.is(memoized(undefined), 0);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo'), 1);
	t.is(memoized('foo', 'bar'), 2);
	t.is(memoized('foo', 'bar'), 2);
	t.is(memoized('foo', 'bar'), 2);
	t.is(memoized(1), 3);
	t.is(memoized(1), 3);
	t.is(memoized(null), 4);
	t.is(memoized(null), 4);
	t.is(memoized(fixture), 5);
	t.is(memoized(fixture), 5);
	t.is(memoized(true), 6);
	t.is(memoized(true), 6);

	// Ensure that functions are stored by reference and not by "value" (e.g. their `.toString()` representation)
	t.is(memoized(() => index++), 7);
	t.is(memoized(() => index++), 8);
});

test('cacheKey option', t => {
	let index = 0;
	const fixture = (..._arguments: any) => index++;
	const memoized = memoize(fixture, {cacheKey: ([firstArgument]) => String(firstArgument)});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	t.is(memoized('1'), 0);
	t.is(memoized('2'), 1);
	t.is(memoized(2), 1);
});

test('memoize with multiple non-primitive arguments', t => {
	let index = 0;
	const memoized = memoize((a?: unknown, b?: unknown, c?: unknown) => index++, {cacheKey: JSON.stringify});
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized({foo: true}, {bar: false}), 1);
	t.is(memoized({foo: true}, {bar: false}), 1);
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
	t.is(memoized({foo: true}, {bar: false}, {baz: true}), 2);
});

test('memoize with regexp arguments', t => {
	let index = 0;
	const memoized = memoize((a?: unknown) => index++, {cacheKey: serializeJavascript});
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(/Sindre Sorhus/), 1);
	t.is(memoized(/Sindre Sorhus/), 1);
	t.is(memoized(/Elvin Peng/), 2);
	t.is(memoized(/Elvin Peng/), 2);
});

test('memoize with Symbol arguments', t => {
	let index = 0;
	const argument1 = Symbol('fixture1');
	const argument2 = Symbol('fixture2');
	const memoized = memoize((a?: unknown) => index++);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	t.is(memoized(argument1), 1);
	t.is(memoized(argument1), 1);
	t.is(memoized(argument2), 2);
	t.is(memoized(argument2), 2);
});

test('maxAge option', async t => {
	let index = 0;
	const fixture = (a?: unknown) => index++;
	const memoized = memoize(fixture, {maxAge: 100});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	await delay(50);
	t.is(memoized(1), 0);
	await delay(200);
	t.is(memoized(1), 1);
});

test('maxAge option deletes old items', async t => {
	let index = 0;
	const fixture = (a?: unknown) => index++;
	const cache = new Map<string, number>();
	const deleted: string[] = [];
	const _delete = cache.delete.bind(cache);
	cache.delete = item => {
		deleted.push(item);
		return _delete(item);
	};

	const memoized = memoize(fixture, {maxAge: 100, cache});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	t.is(cache.has('0:number:1'), true);
	await delay(50);
	t.is(memoized(1), 0);
	t.is(deleted.length, 0);
	await delay(200);
	t.is(memoized(1), 1);
	t.is(deleted.length, 1);
	t.is(deleted[0], '0:number:1');
});

test('maxAge items are deleted even if function throws', async t => {
	let index = 0;
	const fixture = (a?: unknown) => {
		if (index === 1) {
			throw new Error('failure');
		}

		return index++;
	};

	const cache = new Map();
	const memoized = memoize(fixture, {maxAge: 100, cache});
	t.is(memoized(1), 0);
	t.is(memoized(1), 0);
	t.is(cache.size, 1);
	await delay(50);
	t.is(memoized(1), 0);
	await delay(200);
	t.throws(() => {
		memoized(1);
	}, {message: 'failure'});
	t.is(cache.size, 0);
});

test('cache option', t => {
	let index = 0;
	const fixture = (..._arguments: any) => index++;
	const memoized = memoize(fixture, {
		cache: new WeakMap(),
		cacheKey: <ReturnValue>([firstArgument]: [ReturnValue]): ReturnValue => firstArgument,
	});
	const foo = {};
	const bar = {};
	t.is(memoized(foo), 0);
	t.is(memoized(foo), 0);
	t.is(memoized(bar), 1);
	t.is(memoized(bar), 1);
});

test('promise support', async t => {
	let index = 0;
	const memoized = memoize(async (a?: unknown) => index++);
	t.is(await memoized(), 0);
	t.is(await memoized(), 0);
	t.is(await memoized(10), 1);
});

test('preserves the original function name', t => {
	t.is(memoize(function foo() {}).name, 'foo'); // eslint-disable-line func-names, @typescript-eslint/no-empty-function
});

test('.clear()', t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture);
	t.is(memoized(), 0);
	t.is(memoized(), 0);
	memoizeClear(memoized);
	t.is(memoized(), 1);
	t.is(memoized(), 1);
});

test('prototype support', t => {
	class Unicorn {
		index = 0;
		foo() {
			return this.index++;
		}
	}

	Unicorn.prototype.foo = memoize(Unicorn.prototype.foo);

	const unicorn = new Unicorn();

	t.is(unicorn.foo(), 0);
	t.is(unicorn.foo(), 0);
	t.is(unicorn.foo(), 0);
});

test('memoizeDecorator()', t => {
	let returnValue = 1;
	const returnValue2 = 101;

	class TestClass {
		@memoizeDecorator()
		counter() {
			return returnValue++;
		}

		@memoizeDecorator()
		counter2() {
			return returnValue2;
		}
	}

	const alpha = new TestClass();
	t.is(alpha.counter(), 1);
	t.is(alpha.counter(), 1, 'The method should be memoized');
	t.is(alpha.counter2(), 101, 'The method should be memoized separately from the other one');

	const beta = new TestClass();
	t.is(beta.counter(), 2, 'The method should not be memoized across instances');
});

test('memoizeClear() throws when called with a plain function', t => {
	t.throws(() => {
		memoizeClear(() => {}); // eslint-disable-line @typescript-eslint/no-empty-function
	}, {
		message: 'Can\'t clear a function that was not memoized!',
		instanceOf: TypeError,
	});
});

test('memoizeClear() throws when called on an unclearable cache', t => {
	const fixture = () => 1;
	const memoized = memoize(fixture, {
		cache: new WeakMap(),
	});

	t.throws(() => {
		memoizeClear(memoized);
	}, {
		message: 'The cache Map can\'t be cleared!',
		instanceOf: TypeError,
	});
});

test('maxAge - cache item expires after specified duration', async t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: 100});

	t.is(memoized(), 0); // Initial call, cached
	t.is(memoized(), 0); // Subsequent call, still cached
	await delay(150); // Wait for longer than maxAge
	t.is(memoized(), 1); // Cache expired, should compute again
});

test('maxAge - cache expiration timing is accurate', async t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: 100});

	t.is(memoized(), 0);
	await delay(90); // Wait for slightly less than maxAge
	t.is(memoized(), 0); // Should still be cached
	await delay(20); // Total delay now exceeds maxAge
	t.is(memoized(), 1); // Should recompute as cache has expired
});

test('maxAge - expired items are not present in cache', async t => {
	let index = 0;
	const fixture = () => index++;
	const cache = new Map();
	const memoized = memoize(fixture, {maxAge: 100, cache});

	memoized(); // Call to cache the result
	await delay(150); // Wait for cache to expire
	memoized(); // Recompute and recache
	t.is(cache.size, 1); // Only one item should be in the cache
});

test('maxAge - complex arguments and cache expiration', async t => {
	let index = 0;
	const fixture = object => index++;
	const memoized = memoize(fixture, {maxAge: 100, cacheKey: JSON.stringify});

	const argument = {key: 'value'};
	t.is(memoized(argument), 0);
	await delay(150);
	t.is(memoized(argument), 1); // Argument is the same, but should recompute due to expiration
});

test('maxAge - concurrent calls return cached value', async t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: 100});

	t.is(memoized(), 0);
	await delay(50); // Delay less than maxAge
	t.is(memoized(), 0); // Should return cached value
});

test('maxAge - different arguments have separate expirations', async t => {
	let index = 0;
	const fixture = x => index++;
	const memoized = memoize(fixture, {maxAge: 100});

	t.is(memoized('a'), 0);
	await delay(150); // Expire the cache for 'a'
	t.is(memoized('b'), 1); // 'b' should be a separate cache entry
	t.is(memoized('a'), 2); // 'a' should be recomputed
});

test('maxAge - zero maxAge means no caching', t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: 0});

	t.is(memoized(), 0);
	t.is(memoized(), 1); // No caching, should increment
});

test('maxAge - immediate expiration', async t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: 1});
	t.is(memoized(), 0);
	await delay(10);
	t.is(memoized(), 1); // Cache should expire immediately
});

test('maxAge - high concurrency', async t => {
	let index = 0;
	const fixture = () => index++;
	const memoized = memoize(fixture, {maxAge: 50});

	// Simulate concurrent calls
	for (let job = 0; job < 10_000; job++) {
		memoized();
	}

	await delay(100);
	t.is(memoized(), 1);
});

test('maxAge dependent on function parameters', async t => {
	let index = 0;
	const fixture = (x: number) => index++;
	const memoized = memoize(fixture, {
		maxAge: x => x * 100,
	});

	t.is(memoized(1), 0); // Initial call, cached
	await delay(50);
	t.is(memoized(1), 0); // Still cached
	await delay(60);
	t.is(memoized(1), 1); // Cache expired, should compute again

	t.is(memoized(2), 2); // Initial call with different parameter, cached
	await delay(210);
	t.is(memoized(2), 3); // Cache expired, should compute again
});

test('multiple arguments in many combinations', t => {
	const object = {};
	let index = 0;
	const fixture = (a?: unknown, b?: unknown) => index++;
	const memoized = memoize(fixture);

	t.is(memoized(object, 1), 0);
	t.is(memoized(object, 2), 1);
});
