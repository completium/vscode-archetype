import { EventEmitter } from 'events';
import * as vscode from 'vscode';

import * as fs from 'fs';

import debugData from './debug.json'
import { ArchetypeTrace, askClosed, askOpen, EntryPoint, Step, Storage, EntryArg } from './utils';
import { build_execution, extract_trace, gen_contract_map_source } from './utils';


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
	column: number;
	endLine: number;
	endColumn: number;
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

	private sendEvent(event: string, ... args: any[]): void {
		setTimeout(() => {
			this.emit(event, ...args);
		}, 0);
	}

	private _debugData = debugData
	private _filename = ""
	private _entrypoint = ""
	private _inputs : EntryArg[] = []
	private _initStorage : Storage = null
	private _debugTrace : ArchetypeTrace = null
	private _step : Step = null

	private getDebugTrace() : ArchetypeTrace {
		// TODO: change this section to real sys call to archetye binary
		let trace = ""
		const dir = "/Users/benoitrognier/Projects/completium/vscode-archetype/client/src/debugger/"
		if (this._entrypoint == "exec") {
			trace = fs.readFileSync(dir+'debug2_exec.input', 'utf-8');
		} else if (this._entrypoint == "exec2") {
			trace = fs.readFileSync(dir+'debug2_exec2.input', 'utf-8');
		}
		// ......
		const exec_trace = extract_trace(trace)
    const contract_map_source = gen_contract_map_source(JSON.stringify(this._debugData))
    const output = build_execution(contract_map_source, exec_trace)
		return output
	}


	private getEntries() : { [key: string]: number; } {
		const entries : { [key: string]: number; } = {}
		for (let i= 0; i< this._debugData.interface.entrypoints.length; i++) {
			entries[this._debugData.interface.entrypoints[i].name] = i
		}
		return entries
	}

	/**
	 * Start executing the given program.
	 */
	public async start(program: string, stopOnEntry: boolean, debug: boolean): Promise<void> {
		console.log(`program: ${program}`)
		console.log(`stopOnEntry: ${stopOnEntry}`)
		console.log(`debug: ${debug}`)
		this._filename = program
		const entries = this.getEntries()
		const entryname = await askClosed("Select entry point to debug:", Object.keys(entries))
		this._entrypoint = entryname
		const entrypoint = new EntryPoint(entryname)
		const args = this._debugData.interface.entrypoints[entries[entryname]].args
		for(let i=0; i < args.length; i++) {
			const prompt = `Argument '${args[i].name}' value:`
			const argvalue = await askOpen(prompt, 'Argument value', '0')
			entrypoint.addArg(args[i].name, argvalue, args[i].type_)
		}
		const storage = new Storage()
		for(let i=0; i<this._debugData.interface.storage.length; i++) {
			const name = this._debugData.interface.storage[i].name
			const typ = this._debugData.interface.storage[i].type_
			const prompt = `Storage element '${name}' value:`
			const value = await askOpen(prompt, 'Element value', '0')
			storage.addElement(name, value, typ)
		}
		console.log(entrypoint.toString())
		console.log(storage.toString())
		this._initStorage = storage
		this._inputs = entrypoint.args
		this._debugTrace = this.getDebugTrace()
		console.log(JSON.stringify(this._debugTrace))
		this.sendEvent('stopOnEntry')
	}

	public getStorageVariables() : RuntimeVariable[] {
		if (this.instruction == -1) {
			return this._initStorage.elements().map(x => {
				return new RuntimeVariable(x.name, x.value)
			})
		} else {
			return this._step.stack.filter(x => {
				return this._initStorage.elements().some(item => item.name == x.name)
			}).map(x => {
				const value = EntryArg.format(x.value, this._initStorage.getType(x.name))
				return new RuntimeVariable(x.name, value)
			})
		}
	}

	public getInputVariables() : RuntimeVariable[] {
		return this._inputs.map(x => {
			return new RuntimeVariable(x.name, x.value)
		})
	}

	public getLocalVariables() : RuntimeVariable[] {
		if(this.instruction >= 0) {
			return this._step.stack.filter(x => {
				return !this._initStorage.elements().some(item => item.name == x.name) && !this._inputs.some(item => item.name == x.name)
			}).map(x => {
				return new RuntimeVariable(x.name, x.value)
			})
		}
		return []
 	}

	// This is the next instruction that will be 'executed'
	public instruction = -1;

	private displayStep(step : Step) {
		console.log(step)
	}

	public step(instruction: boolean, reverse: boolean) {
		console.log('Next Step')
		if (reverse) {
			this.instruction--;
		} else {
			this.instruction++;
		}

		if (this.instruction >= 0 && this.instruction < this._debugTrace.steps.length - 1) {
			this._step = this._debugTrace.steps[this.instruction];
			console.log(JSON.stringify(this._step, null,2))
			this.sendEvent('stopOnEntry')
		}

	}

	public stack() : IRuntimeStack  {
		const frames: IRuntimeStackFrame[] = [];
		let step = this._debugTrace.steps[this.instruction + 1];
		let line = 0
		let column = 0
		let endLine = 0
		let endColumn = 0
		if (step.decl_bound != undefined) {
			// this is last step; retrieve location from debug data
			const range = this._debugData.interface.entrypoints[this.getEntries()[this._entrypoint]].range
			line = range.end_.line
			column = 0
			endLine = range.end_.line
			endColumn = range.end_.col
		} else {
			line = step.range.begin.line
			column = step.range.begin.col
			endLine = step.range.end.line
			endColumn = step.range.end.col
		}
		frames.push({
			index      : this.instruction,
			name       : this._entrypoint,
			file       : this._filename,
			line       : line,
			column     : column,
			endLine    : endLine,
			endColumn  : endColumn,
			instruction: this.instruction
		})

		return {
			frames: frames,
			count: 0
		}
	}
}