
interface ExecutionParams {
	entrypoint: string,
	argument: string
}

interface ItemTrace {
	location: number,
	gas: number,
	stack: Array<string>
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

export function extract_trace(input: string): Array<ItemTrace> {
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
	return res
}

function fetch_execution(ep: ExecutionParams) {
	const input = ``;

}