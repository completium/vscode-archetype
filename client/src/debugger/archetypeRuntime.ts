
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { ArchetypeTrace, Step } from './utils';

export interface FileAccessor {
	isWindows: boolean;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, contents: Uint8Array): Promise<void>;
}

export interface IRuntimeBreakpoint {
	id: number;
	line: number;
	verified: boolean;
}

interface IRuntimeStepInTargets {
	id: number;
	label: string;
}

interface IRuntimeStackFrame {
	index: number;
	name: string;
	file: string;
	line: number;
	column?: number;
	instruction?: number;
}

interface IRuntimeStack {
	count: number;
	frames: IRuntimeStackFrame[];
}

interface RuntimeDisassembledInstruction {
	address: number;
	instruction: string;
	line?: number;
}

export type IRuntimeVariableType = number | boolean | string | RuntimeVariable[];

export class RuntimeVariable {
	private _memory?: Uint8Array;

	public reference?: number;

	public get value() {
		return this._value;
	}

	public set value(value: IRuntimeVariableType) {
		this._value = value;
		this._memory = undefined;
	}

	public get memory() {
		if (this._memory === undefined && typeof this._value === 'string') {
			this._memory = new TextEncoder().encode(this._value);
		}
		return this._memory;
	}

	constructor(public readonly name: string, private _value: IRuntimeVariableType) { }

	public setMemory(data: Uint8Array, offset = 0) {
		const memory = this.memory;
		if (!memory) {
			return;
		}

		memory.set(data, offset);
		this._memory = memory;
		this._value = new TextDecoder().decode(memory);
	}
}

interface Word {
	name: string;
	line: number;
	index: number;
}

export function timeout(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * A Mock runtime with minimal debugger functionality.
 * MockRuntime is a hypothetical (aka "Mock") "execution engine with debugging support":
 * it takes a Markdown (*.md) file and "executes" it by "running" through the text lines
 * and searching for "command" patterns that trigger some debugger related functionality (e.g. exceptions).
 * When it finds a command it typically emits an event.
 * The runtime can not only run through the whole file but also executes one line at a time
 * and stops on lines for which a breakpoint has been registered. This functionality is the
 * core of the "debugging support".
 * Since the MockRuntime is completely independent from VS Code or the Debug Adapter Protocol,
 * it can be viewed as a simplified representation of a real "execution engine" (e.g. node.js)
 * or debugger (e.g. gdb).
 * When implementing your own debugger extension for VS Code, you probably don't need this
 * class because you can rely on some existing debugger or runtime.
 */
export class ArchetypeRuntime extends EventEmitter {

	constructor(private fileAccessor: FileAccessor) {
		super();
	}

	/**
	 * Start executing the given program.
	 */
	public async start(program: string, stopOnEntry: boolean, debug: boolean): Promise<void> {
		console.log(`program: ${program}`)
	}

	// This is the next instruction that will be 'executed'
	public instruction = 0;

	private displayStep(step : Step) {

	}

	public step(instruction: boolean, reverse: boolean) {
		const trace : ArchetypeTrace = {"steps":[{"stack":[{"name":"a","value":"0"}],"decl_bound":{"kind":"entry","name":"exec","bound":"begin"}},{"stack":[{"name":"v","value":"2"},{"name":"a","value":"0"}],"range":{"name":"./client/tests/resources/debug.arl","begin":{"line":6,"col":1,"char":55},"end":{"line":6,"col":10,"char":64}}},{"stack":[{"name":"v","value":"2"},{"name":"a","value":"2"}],"range":{"name":"./client/tests/resources/debug.arl","begin":{"line":7,"col":1,"char":67},"end":{"line":7,"col":7,"char":73}}},{"stack":[{"name":"a","value":"2"}],"decl_bound":{"kind":"entry","name":"exec","bound":"end"}}]}
		if (reverse) {
			this.instruction--;
		} else {
			this.instruction++;
		}

		if (this.instruction >= 0 && this.instruction < trace.steps.length) {
			const step = trace[this.instruction];
			this.displayStep(step);
		}


	}
}