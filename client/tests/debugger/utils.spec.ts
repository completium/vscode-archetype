import { expect } from 'chai';
import * as fs from 'fs';
import { build_execution, extract_trace, gen_contract_map_source, processConstParams } from '../../src/debugger/utils';

describe('utils', () => {
  it('processConstParams', () => {
    const params = [
      { name: "initial_holder", value: '"tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"' },
      { name: "total_supply", value: '1000' },
      { name: "metadata_coin", value: '"KT1R7G7Mv3MDB94dxxSebpiVd3zJUdxr5m2C"'},
      { name: "complex", value: 'Pair 0 1' },
      { name: "list", value: '{ 0 ; 1 ; 2 }' },
    ]
    const input0 = `{ Elt const_initial_holder__ (Pair const_total_supply__ {  }) }`
    const expected0 = `{ Elt "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb" (Pair 1000 {  }) }`
    const actual0 = processConstParams(input0, params)
    expect(actual0).equal(expected0);

    const input1 = `{ Elt 0 (Pair 0 { Elt \"\" const_metadata_coin__ }) }`
    const expected1 = `{ Elt 0 (Pair 0 { Elt \"\" "KT1R7G7Mv3MDB94dxxSebpiVd3zJUdxr5m2C" }) }`
    const actual1 = processConstParams(input1, params)
    expect(actual1).equal(expected1);

    const input2 = `Pair const_complex__ const_complex__`
    const expected2 = `Pair (Pair 0 1) (Pair 0 1)`
    const actual2 = processConstParams(input2, params)
    expect(actual2).equal(expected2);

    const input3 = `Pair const_complex__ const_list__`
    const expected3 = `Pair (Pair 0 1) { 0 ; 1 ; 2 }`
    const actual3 = processConstParams(input3, params)
    expect(actual3).equal(expected3);
  })
})


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

  it('extract_trace_fail', () => {
    const input = `
    Runtime error in contract KT1BEqzn5Wx8uJrZNvuS9DVHmLvG9td3fDLi:
  1: { storage unit ;
  2:   parameter (unit %exec) ;
  3:   code { UNPAIR ; DROP 1 ; PUSH nat 2 ; PUSH string "mystr" ; PAIR ; FAILWITH } }
  4:
At line 3 characters 69 to 77,
script reached FAILWITH instruction
with (Pair "mystr" 2)
trace
  - location: 7 (just consumed gas: 6.178)
    [ (Pair Unit Unit) ]
  - location: 7 (just consumed gas: 0.010)
    [ Unit
      Unit ]
  - location: 8 (just consumed gas: 0.032)
    [ Unit ]
  - location: 10 (just consumed gas: 0.010)
    [ 2
      Unit ]
  - location: 13 (just consumed gas: 0.010)
    [ "mystr"
      2
      Unit ]
  - location: 16 (just consumed gas: 0.010)
    [ (Pair "mystr" 2)
      Unit ]
Fatal error:
  error running script
`

    const expectedOutput = {
      fail: "(Pair \"mystr\" 2)",
      items: [
        { location: 7, gas: 6.178, stack: ["(Pair Unit Unit)"] },
        { location: 7, gas: 0.010, stack: ["Unit", "Unit"] },
        { location: 8, gas: 0.032, stack: ["Unit"] },
        { location: 10, gas: 0.010, stack: ["2", "Unit"] },
        { location: 13, gas: 0.010, stack: ["\"mystr\"", "2", "Unit"] },
        { location: 16, gas: 0.010, stack: ["(Pair \"mystr\" 2)", "Unit"] },
      ]
    };
    const actualOutput = extract_trace(input);
    console.log(JSON.stringify(actualOutput, null, 2))
    expect(actualOutput).to.deep.equal(expectedOutput);
  })
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