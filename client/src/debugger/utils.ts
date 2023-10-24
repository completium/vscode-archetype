import * as child_process from 'child_process';
import { isNumber } from 'util';
import * as vscode from 'vscode';

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

function countCharOccurrences(inputString, charToCount) {
  let count = 0;

  for (let i = 0; i < inputString.length; i++) {
    if (inputString[i] === charToCount) {
      count++;
    }
  }

  return count;
}

function is_micheline_valid(str : string) : boolean {
	return countCharOccurrences(str, "{") - countCharOccurrences(str, "}") == 0
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
				const s2 = s1.split("\n");
				const stack: Array<string> = [];
				let accu = "";
				for (const cl of s2) {
					accu += cl
					if (is_micheline_valid(accu)) {
						stack.push(accu)
						accu = "";
					} else {
						accu += "\n"
					}
				}
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

export function removeDoubleQuotes(input: string): string {
  if (input.startsWith('"') && input.endsWith('"')) {
    // Remove the first and last characters (the double quotes)
    return input.substring(1, input.length - 1);
  }
  // Return the original string if it doesn't start and end with double quotes
  return input;
}

function isValidString(input: string): boolean {
  for (let i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) > 127) {
      return false; // caractère non-ASCII trouvé, donc la chaîne n'est pas valide
    }
  }
  return true; // aucun caractère non-ASCII trouvé, donc la chaîne est valide
}


export class EntryArg {
	private _name: string;
	private _value: any;
	private _type  : string

	public static format(value : string, typ : string) : any {
		switch(typ) {
			case "nat":
			case "int": return parseInt(value, 10)
			case "bytes" :
			case "string" : return removeDoubleQuotes(value)
			case "bool" : return (value == "True" ? true : false)
			default : return value
		}
	}

	constructor(name: string, value: string, typ ?: string) {
		this._type = typ ? typ : "string"
		switch(this._type) {
			case 'nat' : if(!isNat(value)) throw new InputError("argument", "a nat value is expected"); break
			case 'int' : if(!isInteger(value)) throw new InputError("argument", "an integer value is expected"); break
			case 'address' : if(!isAddress(value)) throw new InputError("argument", "an address value is expected"); break
			case 'timestamp': if(!isDate(value)) throw new InputError("argument", "a date value 'YYYY-MM-DD dd:mm:ss' is expected"); break
			case 'string': if(!isValidString(removeDoubleQuotes(value))) throw new InputError("argument", "a string with non extended ASCII characters is expected")
			default: {}
		}
		this._name = name;
		this._value = EntryArg.format(value, typ)
	}

	// Getters
	public get name(): string {
			return this._name;
	}

	public get value(): any {
			return this._value;
	}

	// Setters
	public set name(name: string) {
			this._name = name;
	}

	public set value(value: string) {
			this._value = value;
	}

	public get typ() : string {
		return this._type
	}

	public toString(): string {
			return `EntryArg(name: ${this._name}, value: ${this._value}, type: ${this._type})`;
	}
}

export class EntryPoint {
	private _name: string;
	private _args: EntryArg[];

	constructor(name: string) {
			this._name = name;
			this._args = []; // initialiser la liste comme vide
	}

	// Getters
	public get name(): string {
			return this._name;
	}

	public get args(): EntryArg[] {
			return this._args;
	}

	// Setters
	public set name(name: string) {
			this._name = name;
	}

	// Méthode pour ajouter un nouvel EntryArg
	public addArg(name: string, val ?: string, typ ?: string): void {
			this._args.push(new EntryArg(name, val, typ));
	}

	public toString(): string {
			return `EntryPoint(name: ${this._name}, args: [${this._args.map(arg => arg.toString()).join(', ')}])`;
	}
}

export class Storage {
	constructor() {
		this._args = []
	}
	private _args: EntryArg[];
	public addElement(name: string, val ?: string, typ ?: string): void {
		this._args.push(new EntryArg(name, val, typ));
	}
	public toString(): string {
		return `Storage([${this._args.map(arg => arg.toString()).join(', ')}])`;
	}
	public elements() : Array<EntryArg> { return this._args }

	public getType(name : string) : string {
		for(let i=0; i<this._args.length; i++) {
			if (this._args[i].name == name) {
				return this._args[i].typ
			}
		}
		return ""
	}
}

export async function askOpen(prompt: string, placeHolder: string, def: string) : Promise<string | undefined> {
	const value = await vscode.window.showInputBox({
		prompt: prompt, // Le texte à afficher pour guider l'utilisateur
		placeHolder: placeHolder, // Texte affiché à l'intérieur de la zone de saisie
		value : def // Valeur par défaut déjà remplie
	});

	console.log(`${prompt} : ${value}`)
	return value
}

export async function askOpenValidate(prompt : string, placeHolder : string, def : string, validate : (string) => void) {
	let ko = true
	while(ko) {
		try {
			const v = await askOpen(prompt, placeHolder, def)
			validate(v)
			ko = false
		} catch (e) {
			if (e instanceof InputError) {
				vscode.window.showErrorMessage(e.message)
				ko = true
			}
		}
	}
}

export async function askClosed(prompt : string, options : string[]) : Promise<string | undefined> {
	const value = await vscode.window.showQuickPick(options, {
		placeHolder: prompt, // Texte à afficher pour guider l'utilisateur
	});
	console.log(`${prompt} : ${value}`)
	return value
}

export function toPair(elements : any[]) : string {
	if (elements.length == 0) {
		return "Unit"
	} else if(elements.length == 1) {
		return "" + elements[0]
	} else if(elements.length == 2) {
		return `(Pair ${elements[0]} ${elements[1]})`
	} else {
		return `(Pair ${elements[0]} ${toPair(elements.slice(1))})`
	}
}

function toMichelson(value : any, ty : string) : string {
	switch (ty) {
		case "string": return `"${value}"`
		case "bool": return value ? "True" : "False"
		default: return value
	}
}

export function argsToMich(elements : EntryArg[]) : string {
	return toPair(elements.map(x => toMichelson(x.value, x.typ)))
}

export function executeCommand(command: string): Promise<string> {
	return new Promise((resolve, reject) => {
		child_process.exec(command, (error, stdout, stderr) => {
			if (error) {
				vscode.window.showErrorMessage(`exec error: ${error}`)
				reject(error);
				return;
			}
			if (stderr) {
				vscode.window.showErrorMessage(`stderr: ${stderr}`);
				reject(new Error(`Error executing command: ${stderr}`));
				return;
			}
			resolve(stdout);
		});
	});
}

export interface DebugData {
  name: string;
  interface: {
    entrypoints: Array<{
      name: string;
      args: Array<{
        name: string;
        type_: string;
      }>;
      range: {
        name: string;
        begin_: {
          line: number;
          col: number;
          char: number;
        };
        end_: {
          line: number;
          col: number;
          char: number;
        };
      };
    }>;
    storage: Array<{
      name: string;
      type_: string;
      value: string;
    }>;
  };
  contract: any
}

class InputError extends Error {
	constructor(errorTyp: string, detail : string) {
			// Appel du constructeur de la classe parent `Error`
			super("Invalid " + errorTyp + " value: " + detail);

			// Rétablissement du prototype, une correction nécessaire pour faire fonctionner `instanceof` avec les classes personnalisées d'erreur étendant Error en TypeScript
			Object.setPrototypeOf(this, new.target.prototype);

			// Préservation du nom de la classe
			this.name = InputError.name; // ou hard-codez le nom si la minification du code est un problème

			// Capturer la trace de la pile si disponible
			if (Error.captureStackTrace) {
					Error.captureStackTrace(this, InputError);
			}
	}
}

function isNat(value: string): boolean {
	// Vérifie d'abord si la chaîne est un nombre valide
	const number = Number(value);

	// Ensuite, vérifie si c'est un entier et s'il est non négatif
	return Number.isInteger(number) && number >= 0;
}

function isInteger(value: string) : boolean {
	const number = Number(value);
	return  Number.isInteger(number)
}

function isAddress(address: string): boolean {
	// Les préfixes valides pour les adresses Tezos
	const validPrefixes = ['tz1', 'tz2', 'tz3', 'KT1', 'KT2'];

	// La longueur typique d'une adresse Tezos
	const addressLength = 36;

	// Vérifie si l'adresse a la bonne longueur
	if (address.length !== addressLength) {
			return false;
	}

	// Vérifie si l'adresse commence par l'un des préfixes valides
	for (const prefix of validPrefixes) {
			if (address.startsWith(prefix)) {
					return true;
			}
	}

	// Si l'adresse n'a pas passé les vérifications, retourne false
	return false;
}

function isDate(dateTimeString: string): boolean {
	// Expression régulière pour vérifier le format "YYYY-MM-DD hh:mm:ss"
	const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

	// Vérifier si la chaîne correspond au format
	if (!regex.test(dateTimeString)) {
			return false;
	}

	// Vérifier si la chaîne représente une date valide
	const date = new Date(dateTimeString);
	return date instanceof Date && !isNaN(date.getTime());
}

export function getCurrentDateTime(): string {
	const date = new Date();

	// Fonction d'aide pour ajouter un zéro devant les nombres < 10
	const pad = (num: number) => (num < 10 ? `0${num}` : num);

	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1); // Les mois vont de 0 à 11, donc on ajoute 1
	const day = pad(date.getDate());
	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());
	const seconds = pad(date.getSeconds());

	// Construction de la chaîne de date au format "YYYY-MM-DD hh:mm:ss"
	const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

	return formattedDate;
}

export function dateStringToSeconds(dateString: string): number | null {
	// Vérifier le format de la chaîne de date
	const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
	if (!regex.test(dateString)) {
			console.error("Invalid date. Use 'YYYY-MM-DD hh:mm:ss'.");
			return null;
	}

	// Convertir la chaîne de date en objet Date
	const date = new Date(dateString);

	// Vérifier si la date est valide
	if (isNaN(date.getTime())) {
			console.error("Invalid date");
			return null;
	}

	// Convertir l'objet Date en nombre de secondes depuis l'époque Unix
	const seconds = Math.floor(date.getTime() / 1000);
	return seconds;
}

function secondsToDateString(seconds: number): string {
	// Convertir les secondes en millisecondes (car JavaScript utilise des millisecondes pour les dates)
	const date = new Date(seconds * 1000);

	// Fonction d'aide pour ajouter un zéro devant les nombres < 10
	const pad = (num: number) => (num < 10 ? `0${num}` : num);

	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1); // Les mois vont de 0 à 11, donc on ajoute 1
	const day = pad(date.getDate());
	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());
	const secondsString = pad(date.getSeconds());

	// Construction de la chaîne de date au format "YYYY-MM-DD hh:mm:ss"
	const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${secondsString}`;

	return formattedDate;
}

export class CallParameters {
	private _transferred : string = ""
	private _caller : string = ""
	private _source : string = ""
	private _now : string = ""
	private _level : string = ""
	private _balance : string = ""
	private _sefladdress : string = ""
	constructor() {
		this._now = getCurrentDateTime()
		this._transferred = "0"
		this._balance = "0"
		this._level = "0"
		this._caller = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"
		this._source = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"
		this._sefladdress = "KT1BEqzn5Wx8uJrZNvuS9DVHmLvG9td3fDLi"
	}
	/**
	 * @throws Error when transferred amount is not a positive integer
	 */
	public setTransferred(v : string) {
		if(isNat(v)) {
			this._transferred = v
		} else {
			throw new InputError("transferred", "should be a positive integer value")
		}
	}
	public setCaller(v : string) {
		if(isAddress(v)) {
			this._caller = v
		} else {
			throw new InputError("caller", "value is not a valid Tezos address")
		}
	}
	public setSource(v : string) {
		if(isAddress(v)) {
			this._source = v
		} else {
			throw new InputError("caller", "value is not a valid Tezos address")
		}
	}
	public setNow(v : string) {
		if(isDate(v)) {
			this._now = v
		} else {
			throw new InputError("now", "invalid date value (should not have milliseconds)")
		}
	}
	public setLevel(v : string) {
		if(isNat(v)) {
			this._level = v
		} else {
			throw new InputError("level", "should be a positive integer")
		}
	}
	public setBalance(v : string) {
		if(isNat(v)) {
			this._balance = v
		} else {
			throw new InputError("balance", "should be a positive integer")
		}
	}
	public setSelfAddress(v : string) {
		if(isAddress(v) && v.startsWith("KT1")) {
			this._sefladdress = v
		} else {
			throw new InputError("self-address", "should be a valid contract address")
		}
	}
	public get caller(): string {
		return this._caller;
	}

	public get source(): any {
		return this._source;
	}

	public get transferred(): any {
		return this._transferred;
	}

	public get level(): any {
		return this._level;
	}

	public get now(): any {
		return this._now;
	}

	public get balance() : any {
		return this._balance
	}

	public get selfaddress() : any {
		return this._sefladdress
	}
}
