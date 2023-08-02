
interface ExecutionParams {
	entrypoint: string,
	argument: string
}

interface ItemTrace {
	location: number,
	gas: number,
	stack: Array<string>
}

interface Trace {
	items: Array<ItemTrace>
}

type Mstring = {
	"string": string
}

type Mbytes = {
	"bytes": string
}

type Mint = {
	"int": string
}

type StackItem = {
	"name": string
}

type Position = {
	"line": number
	"col": number
	"char": number
}

type RangeItem = {
	"name": string
	"begin": Position
	"end": Position
}

type DeclBound = {
	kind: string
	name: string
	bound: ("begin" | "end")
}

type ObjDebug = {
	stack: Array<StackItem>
	range?: RangeItem
	decl_bound?: DeclBound
}

type Mprim = {
	"prim": string
	"args"?: Array<ExtMicheline>
	"annots"?: Array<string>
	"debug"?: ObjDebug
}

type Marray = Array<ExtMicheline>

type ExtMicheline =
	| Mprim
	| Mint
	| Mbytes
	| Mstring
	| Marray

type ContractMapSource = {
	contract: ExtMicheline
}

export type StackItemValue = {
	"name": string
	"value": string
}

export type Step = {
	"stack": Array<StackItemValue>
  "range"?: RangeItem
	"decl_bound"?: DeclBound
}

export type ArchetypeTrace = {
	steps: Array<Step>
}

function removeFirstLine(str: string): string {
	let index = str.indexOf('\n');
	return index !== -1 ? str.slice(index + 1) : '';
}

function removeFirstAndLastCharacter(str: string): string {
	if (str.length <= 2) {
		return '';
	}
	return str.slice(1, -1);
}

export function extract_trace(input: string): Trace {
	if (!input || input.trim().length === 0) {
		throw new Error("Invalid input, empty.");
	}
	const trIndex = input.indexOf("trace");
	if (trIndex < 0) {
		throw new Error("Input does not contain trace keyword.");
	}
	const tr_raw = input.split("trace")
	const trs = tr_raw[1].split("\n  - ")
	const res: Array<ItemTrace> = []
	for (const tr of trs) {
		if (tr.length > 0) {
			const lines = tr.split("\n");
			const fl = lines[0];
			const rx = /location:\s(\d+).*gas:\s([\d\.]+)/;
			const arr = rx.exec(fl)
			if (arr && arr.length === 3) {
				const location = Number.parseInt(arr[1]);
				const gas = Number.parseFloat(arr[2]);
				const stack_raw = removeFirstLine(tr).trim();
				const s1 = removeFirstAndLastCharacter(stack_raw);
				const stack: Array<string> = s1.split("\n").map(x => { return x.trim() });
				res.push({ location: location, gas: gas, stack: stack });
			} else {
				// Invalid regex match, skip this trace item.
				console.error("Invalid regex match for trace item:", tr);
			}
		}
	}
	return { items: res }
}

export function gen_contract_map_source(input: string): ContractMapSource {
	const res: ContractMapSource = JSON.parse(input);
	return res
}

function build_map_ext_micheline(micheline: ExtMicheline): Map<number, ExtMicheline> {
	let res = new Map<number, ExtMicheline>();

	const aux = (micheline: ExtMicheline, location: number): number => {
		const f = (micheline: ExtMicheline) : Array<ExtMicheline> => {
			if ((micheline as Mprim).prim !== undefined) {
				return (micheline as Mprim).args;
			} else if ((micheline as Mint).int !== undefined) {
				return []
			} else if ((micheline as Mbytes).bytes !== undefined) {
				return []
			} else if ((micheline as Mstring).string !== undefined) {
				return []
			} else if ((micheline as Marray).length !== undefined) {
				return (micheline as Marray);
			}
			throw new Error("error: f")
		}

		res.set(location, micheline)
		location = location + 1
		const args = f(micheline);
		for (let i = 0; args !== undefined && i < args.length; ++i) {
			const m = args[i];
			location = aux(m, location)
		}
		return location
	}

	aux(micheline, 0);

	return res
}

function compute_stack_value (stack: Array<StackItem>, values: Array<string>) : Array<StackItemValue> {
	let res = new Array<StackItemValue>();
	for (let i = 0; i < stack.length; ++i) {
		const k = stack[i].name;
		const v = values[i];
		res.push({name: k, value: v});
	}
	return res
}

export function build_execution(contract_map_source: ContractMapSource, trace: Trace): ArchetypeTrace {
	let res: ArchetypeTrace = { steps: [] }
	const map_ext_micheline: Map<number, ExtMicheline> = build_map_ext_micheline(contract_map_source.contract);
	// console.log(map_ext_micheline);
	for (let i = 0; i < trace.items.length; ++i) {
		const trace_item = trace.items[i];
		const ext_micheline: ExtMicheline = map_ext_micheline.get(trace_item.location);
		if ((ext_micheline as Mprim).debug !== undefined) {
			const debug = (ext_micheline as Mprim).debug;
			const stack_value : Array<StackItemValue> = compute_stack_value(debug.stack, trace_item.stack)
			res.steps.push({stack: stack_value, range: debug.range, decl_bound: debug.decl_bound});
		}
	}
	return res
}
