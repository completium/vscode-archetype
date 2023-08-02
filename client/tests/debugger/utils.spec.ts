import { expect } from 'chai';
import * as fs from 'fs';
import { build_execution, extract_trace, gen_contract_map_source } from '../../src/debugger/utils';

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
    const expectedOutput = {
      items: [
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
      ]
    };
    const actualOutput = extract_trace(input);
    expect(actualOutput).to.deep.equal(expectedOutput);
  });

  it('returns an array of ItemTrace objects 2', () => {
    const input = `Disclaimer:
  The  Tezos  network  is  a  new  blockchain technology.
  Users are  solely responsible  for any risks associated
  with usage of the Tezos network.  Users should do their
  own  research to determine  if Tezos is the appropriate
  platform for their needs and should apply judgement and
  care in their network interactions.

storage
  2
emitted operations

big_map diff

trace
  - location: 7 (just consumed gas: 10.117)
    [ (Pair Unit 0) ]
  - location: 7 (just consumed gas: 0.010)
    [ Unit
      0 ]
  - location: 8 (just consumed gas: 0.032)
    [ 0 ]
  - location: 10 (just consumed gas: 0.010)
    [ 2
      0 ]
  - location: 13 (just consumed gas: 0.010)
    [ 2
      2
      0 ]
  - location: 14 (just consumed gas: 0)
    [ 2
      0 ]
  - location: 17 (just consumed gas: 0.036)
    [ 0
      2 ]
  - location: 19 (just consumed gas: 0.032)
    [ 2 ]
  - location: 14 (just consumed gas: 0.025)
    [ 2
      2 ]
  - location: 14 (just consumed gas: 0)
    [ 2
      2 ]
  - location: 21 (just consumed gas: 0.041)
    [ 2
      2 ]
  - location: 23 (just consumed gas: 0.032)
    [ 2 ]
  - location: 25 (just consumed gas: 0.010)
    [ {}
      2 ]
  - location: 27 (just consumed gas: 0.010)
    [ (Pair {} 2) ]
`

    const expectedOutput = {
      items: [
        { location: 7, gas: 10.117, stack: ["(Pair Unit 0)"] },
        { location: 7, gas: 0.01, stack: ["Unit", "0"] },
        { location: 8, gas: 0.032, stack: ["0"] },
        { location: 10, gas: 0.01, stack: ["2", "0"] },
        { location: 13, gas: 0.01, stack: ["2", "2", "0"] },
        { location: 14, gas: 0, stack: ["2", "0"] },
        { location: 17, gas: 0.036, stack: ["0", "2"] },
        { location: 19, gas: 0.032, stack: ["2"] },
        { location: 14, gas: 0.025, stack: ["2", "2"] },
        { location: 14, gas: 0, stack: ["2", "2"] },
        { location: 21, gas: 0.041, stack: ["2", "2"] },
        { location: 23, gas: 0.032, stack: ["2"] },
        { location: 25, gas: 0.01, stack: ["{}", "2"] },
        { location: 27, gas: 0.01, stack: ["(Pair {} 2)"] }
      ]
    };
    const actualOutput = extract_trace(input);
    expect(actualOutput).to.deep.equal(expectedOutput);
  });
});

describe('generate_steps', () => {
  it('build_execution', () => {
    const exec_trace_input = fs.readFileSync('./tests/resources/debug.input', 'utf-8');
    const debug_json = fs.readFileSync('./tests/resources/debug.json', 'utf-8');
    const exec_trace = extract_trace(exec_trace_input);
    const contract_map_source = gen_contract_map_source(debug_json);
    const actualOutput = build_execution(contract_map_source, exec_trace);
    const expectedOutput = {
      "steps": [
        {
          "stack": [
            {
              "name": "a",
              "value": "0"
            }
          ],
          "decl_bound": {
            "kind": "entry",
            "name": "exec",
            "bound": "begin"
          }
        },
        {
          "stack": [
            {
              "name": "v",
              "value": "2"
            },
            {
              "name": "a",
              "value": "0"
            }
          ],
          "range": {
            "name": "./client/tests/resources/debug.arl",
            "begin": {
              "line": 6,
              "col": 1,
              "char": 55
            },
            "end": {
              "line": 6,
              "col": 10,
              "char": 64
            }
          }
        },
        {
          "stack": [
            {
              "name": "v",
              "value": "2"
            },
            {
              "name": "a",
              "value": "2"
            }
          ],
          "range": {
            "name": "./client/tests/resources/debug.arl",
            "begin": {
              "line": 7,
              "col": 1,
              "char": 67
            },
            "end": {
              "line": 7,
              "col": 7,
              "char": 73
            }
          }
        },
        {
          "stack": [
            {
              "name": "a",
              "value": "2"
            }
          ],
          "decl_bound": {
            "kind": "entry",
            "name": "exec",
            "bound": "end"
          }
        }
      ]
    };
    console.log(JSON.stringify(actualOutput))
    // expect(actualOutput).to.deep.equal(expectedOutput);
  })
})