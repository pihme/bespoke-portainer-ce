import {
  getAllSettledItems,
  getFulfilledResults,
  isFulfilled,
  isRejected,
  promiseSequence,
} from './promise-utils';

describe('promiseSequence', () => {
  it('should run successfully for an empty list', async () => {
    await expect(promiseSequence([])).resolves.toBeUndefined();
  });

  it('provided two promise functions, the second should run after the first', async () => {
    const callback = vi.fn();

    function first() {
      return Promise.resolve(callback(1));
    }

    function second() {
      return Promise.resolve(callback(2));
    }

    await promiseSequence([first, second]);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 1);
    expect(callback).toHaveBeenNthCalledWith(2, 2);
  });
});

describe('getAllSettledItems', () => {
  it('splits fulfilled and rejected items and keeps Error messages', async () => {
    const result = await getAllSettledItems(['ok', 'bad', 'also-ok'], async (item) => {
      if (item === 'bad') {
        throw new Error('nope');
      }
    });

    expect(result.fulfilledItems).toEqual(['ok', 'also-ok']);
    expect(result.rejectedItems).toEqual([{ item: 'bad', reason: 'nope' }]);
  });

  it('stringifies non-Error rejection reasons', async () => {
    const result = await getAllSettledItems(['x'], async () => {
      // eslint-disable-next-line no-throw-literal
      throw 'plain-fail';
    });
    expect(result.rejectedItems).toEqual([{ item: 'x', reason: 'plain-fail' }]);
  });
});

describe('promise settlement helpers', () => {
  it('isFulfilled and isRejected discriminate PromiseSettledResult', () => {
    const fulfilled: PromiseSettledResult<number> = { status: 'fulfilled', value: 1 };
    const rejected: PromiseSettledResult<number> = {
      status: 'rejected',
      reason: new Error('x'),
    };
    expect(isFulfilled(fulfilled)).toBe(true);
    expect(isRejected(fulfilled)).toBe(false);
    expect(isFulfilled(rejected)).toBe(false);
    expect(isRejected(rejected)).toBe(true);
  });

  it('getFulfilledResults maps fulfilled values only', () => {
    const results: Array<PromiseSettledResult<string>> = [
      { status: 'fulfilled', value: 'a' },
      { status: 'rejected', reason: 'no' },
      { status: 'fulfilled', value: 'b' },
    ];
    expect(getFulfilledResults(results)).toEqual(['a', 'b']);
  });
});
