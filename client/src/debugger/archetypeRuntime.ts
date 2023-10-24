import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { ArchetypeTrace, argsToMich, askClosed, askOpen, askOpenValidate, CallParameters, dateStringToSeconds, DebugData, EntryArg, EntryPoint, getCurrentDateTime, removeDoubleQuotes, Step, Storage } from './utils';
import { build_execution, executeCommand, extract_trace, gen_contract_map_source } from './utils';

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

	private _debugData : DebugData = null
	private _filename = ""
	private _entrypoint = ""
	private _inputs : EntryArg[] = []
	private _initStorage : Storage = null
	private _debugTrace : ArchetypeTrace = null
	private _step : Step = null
	private _parameters : CallParameters = null

	public async generateDebugData(arlFilePath: string): Promise<DebugData> {
		try {
   		const config = vscode.workspace.getConfiguration('archetype');
			const archetype_exec = config.get('archetypeBin');

			// Replace with the actual path to the 'archetype' command if it's not in $PATH
			const command = `${archetype_exec} -t debug-trace ${arlFilePath}`;

			// Execute the command
			const output = await executeCommand(command);

			// Parse the command's output and cast it to the IDebug2 type
			const debugData: DebugData = JSON.parse(output);
			return debugData;
		} catch (error) {
			// Handle errors as appropriate for your application's requirements
			throw error;
		}
	}

	public compile(sourceFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
			const config = vscode.workspace.getConfiguration('archetype');
			const archetype_exec = config.get('archetypeBin');

			// compilation is in debug mode
      const command = `${archetype_exec} -g ${sourceFile}`;

      executeCommand(command)
        .then((output) => {
          // Get the system temporary directory
          const tmpDir = os.tmpdir();

          // Generate a unique file name with an extension
          const tmpFilePath = path.join(tmpDir, `output_${Date.now()}.txt`);

          // Write the command output to the temporary file
          fs.writeFile(tmpFilePath, output, 'utf8', (err) => {
            if (err) {
              console.error(`Failed to write to temp file: ${err}`);
              reject(err);
            } else {
              resolve(tmpFilePath);
            }
          });
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

	private executeTrace(storage: string, input: string, entrypoint: string, tzSource: string): Promise<string> {
    // Construct the command string
		const config = vscode.workspace.getConfiguration('archetype');
		const octez_client_exec = config.get('octezClientBin');
		const base_dir = config.get('mockupBaseDir');

		const parameters = `--amount '${this._parameters.transferred}' --source '${this._parameters.caller}' --self-address '${this._parameters.selfaddress}' --now '${dateStringToSeconds(this._parameters.now)}' --level '${this._parameters.level}' --balance '${this._parameters.balance}'`
    const command = `${octez_client_exec} --mode mockup --base-dir ${base_dir} run script ${tzSource} on storage '${storage}' and input '${input}' --entrypoint '${entrypoint}' ${parameters} --trace-stack`;
    // Use the generic executeCommand function to run the command
    return executeCommand(command)
  }

	private async getDebugTrace(program : string) : Promise<ArchetypeTrace> {
		const tzSource = await this.compile(program)
		const entry = this._entrypoint
		const storage = argsToMich(this._initStorage.elements())
		const input = argsToMich(this._inputs)
		const trace = await this.executeTrace(storage, input, entry, tzSource)
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
	public async start(program: string, pargs: string[], stopOnEntry: boolean, debug: boolean): Promise<void> {
		//console.log(`program: ${program}`)
		//console.log(`stopOnEntry: ${stopOnEntry}`)
		//console.log(`debug: ${debug}`)
		this._filename = program
		this._debugData = await this.generateDebugData(program)
		const entries = this.getEntries()
		const entryname = await askClosed("Select entry point to debug:", Object.keys(entries))
		this._entrypoint = entryname
		const entrypoint = new EntryPoint(entryname)
		const args = this._debugData.interface.entrypoints[entries[entryname]].args
		for(let i=0; i < args.length; i++) {
			const prompt = `Argument '${args[i].name}' value:`
			await askOpenValidate(prompt, 'Argument value', '', (x) => entrypoint.addArg(args[i].name, x, args[i].type_))
		}
		const storage = new Storage()
		for(let i=0; i<this._debugData.interface.storage.length; i++) {
			const name = this._debugData.interface.storage[i].name
			const typ = this._debugData.interface.storage[i].type_
			const def = this._debugData.interface.storage[i].value
			const prompt = `Storage element '${name}' value:`
			await askOpenValidate(prompt, 'Element value', removeDoubleQuotes(def), x => storage.addElement(name, x, typ))
		}
		//console.log(entrypoint.toString())
		//console.log(storage.toString())
		this._initStorage = storage
		this._inputs = entrypoint.args
		this._parameters = new CallParameters()
		if (pargs != undefined && pargs.find(x => x == '--all')) {
			this._parameters = new CallParameters()
			// caller
			await askOpenValidate("Set caller's address", 'Caller address', this._parameters.caller, (x) => { this._parameters.setCaller(x) })
			await askOpenValidate("Set transferred amount value", 'Amount value', this._parameters.transferred, (x) => { this._parameters.setTransferred(x) })
			await askOpenValidate("Set balance value", 'Amount value', this._parameters.balance, (x) => { this._parameters.setBalance(x) })
			await askOpenValidate("Set now value", 'now date', this._parameters.now, (x) => { this._parameters.setNow(x) })
			await askOpenValidate("Set self address", 'Self address', this._parameters.selfaddress, (x) => { this._parameters.setSelfAddress(x) })
			await askOpenValidate("Set level value", 'level', this._parameters.level, (x) => { this._parameters.setLevel(x) })
		}
		this._debugTrace = await this.getDebugTrace(program)
		//console.log(JSON.stringify(this._debugTrace))
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

	public getConstantVariables() : RuntimeVariable[] {
		const transferred = Number.parseInt(this._parameters.transferred)
		const balance = Number.parseInt(this._parameters.balance)
		const level = Number.parseInt(this._parameters.level)
		return [
			new RuntimeVariable("caller", this._parameters.caller),
			new RuntimeVariable("transferred", transferred),
			new RuntimeVariable("balance", balance + transferred),
			new RuntimeVariable("now", this._parameters.now),
			new RuntimeVariable("self_address", this._parameters.selfaddress),
			new RuntimeVariable("level", level),
		]
	}

	public getOperations() : RuntimeVariable[] {
		const l = this._step.stack.filter(x => x.name == '_ops')
		if (l.length > 0) {
			const ops = l[0].value
			const regex = /0x[0-9a-fA-F]+/g;
    	const matches = ops.match(regex);
			return matches.map((x,i) => {
				return new RuntimeVariable(i+"", x)
			})
		}
		return []
	}

	private parseString(input: string): string | number {
		const number = Number(input); // Attempt to convert the string to a number

		// Check if the conversion was successful and the result is not NaN (which occurs when the conversion fails)
		if (!isNaN(number)) {
			return number; // Return the number if the conversion was successful
		} else {
			return input; // Return the original string if the conversion failed
		}
	}

	public getLocalVariables() : RuntimeVariable[] {
		if(this.instruction >= 0) {
			return this._step.stack.filter(x => {
				return x.name != '_ops' && !this._initStorage.elements().some(item => item.name == x.name) && !this._inputs.some(item => item.name == x.name)
			}).map(x => {
				return new RuntimeVariable(x.name, this.parseString(removeDoubleQuotes(x.value)))
			})
		}
		return []
 	}

	public evaluate(name: string) : RuntimeVariable | undefined {
		const storageVars = this.getStorageVariables()
		for(let i=0; i<storageVars.length; i++) {
			if (storageVars[i].name == name) {
				return storageVars[i]
			}
		}
		const localVars = this.getLocalVariables()
		for(let i=0; i<localVars.length; i++) {
			if (localVars[i].name == name) {
				return localVars[i]
			}
		}
		const inputVars = this.getInputVariables()
		for(let i=0; i<inputVars.length; i++) {
			if (inputVars[i].name == name) {
				return inputVars[i]
			}
		}
		const constants = this.getConstantVariables()
		for(let i=0; i<constants.length; i++) {
			if (constants[i].name == name) {
				return constants[i]
			}
		}
		return undefined
	}

	// This is the next instruction that will be 'executed'
	public instruction = -1;

	private displayStep(step : Step) {
		console.log(step)
	}

	public step(instruction: boolean, reverse: boolean) {
		//console.log('Next Step')
		if (reverse) {
			this.instruction--;
		} else {
			this.instruction++;
		}

		if (this.instruction >= 0 && this.instruction < this._debugTrace.steps.length - 1) {
			this._step = this._debugTrace.steps[this.instruction];
			//console.log(JSON.stringify(this._step, null,2))
			this.sendEvent('stopOnEntry')
		} else if (this.instruction >= this._debugTrace.steps.length - 1) {
			this.sendEvent('end');
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