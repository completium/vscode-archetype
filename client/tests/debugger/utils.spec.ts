import { expect } from 'chai';
import { extract_trace } from '../../src/debugger/utils';

describe('extract_trace', () => {
  it('returns an array of ItemTrace objects', () => {
    const input = `
storage
  2
emitted operations

big_map diff

trace
  - location: 7 (just consumed gas: 8.921)
    [ (Pair Unit 0) ]
  - location: 7 (just consumed gas: 0.010)
    [ 0 ]
  - location: 8 (just consumed gas: 0.010)
    [ 2
      0 ]
  - location: 11 (just consumed gas: 0.010)
    [ 2
      2
      0 ]
  - location: 12 (just consumed gas: 0)
    [ 2
      0 ]
  - location: 15 (just consumed gas: 0.010)
    [ 0
      2 ]
  - location: 16 (just consumed gas: 0.032)
    [ 2 ]
  - location: 12 (just consumed gas: 0.025)
    [ 2
      2 ]
  - location: 12 (just consumed gas: 0)
    [ 2
      2 ]
  - location: 18 (just consumed gas: 0.010)
    [ 2
      2 ]
  - location: 19 (just consumed gas: 0.032)
    [ 2 ]
  - location: 21 (just consumed gas: 0.010)
    [ {}
      2 ]
  - location: 23 (just consumed gas: 0.010)
    [ (Pair {} 2) ]
`
    const expectedOutput = [
      { location: 7, gas: 8.921, stack: ['(Pair Unit 0)'] },
      { location: 7, gas: 0.01, stack: ['0'] },
      { location: 8, gas: 0.01, stack: ['2', '0'] },
      { location: 11, gas: 0.01, stack: ['2', '2', '0'] },
      { location: 12, gas: 0, stack: ['2', '0'] },
      { location: 15, gas: 0.01, stack: ['0', '2'] },
      { location: 16, gas: 0.032, stack: ['2'] },
      { location: 12, gas: 0.025, stack: ['2', '2'] },
      { location: 12, gas: 0, stack: ['2', '2'] },
      { location: 18, gas: 0.01, stack: ['2', '2'] },
      { location: 19, gas: 0.032, stack: ['2'] },
      { location: 21, gas: 0.01, stack: ['{}', '2'] },
      { location: 23, gas: 0.01, stack: ['(Pair {} 2)'] },
    ];
    const actualOutput = extract_trace(input);
    expect(actualOutput).to.deep.equal(expectedOutput);
  });
});
