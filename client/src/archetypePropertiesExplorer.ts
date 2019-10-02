import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';


interface Position {
	line: number;
	col: number;
	char: number;
}

interface Location {
	start: Position;
	end: Position;
}

interface Property {
	kind: string[];
	id: string;
	formula: string;
	location: Location;
}

interface Result {
	status: string[];
	objs: Property[];
}

let obj: Result;

export class ArchetypeNodeProvider implements vscode.TreeDataProvider<ArchetypeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<ArchetypeItem | undefined> = new vscode.EventEmitter<ArchetypeItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<ArchetypeItem | undefined> = this._onDidChangeTreeData.event;

	constructor() {
	}

	refresh(): void {
		let fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
		let cmd = 'archetype --service get_properties ' + fsPath;
		let cp = require('child_process');
		cp.exec(cmd, (_err: string, stdout: string, stderr: string) => {
			if (_err) {
				vscode.window.showErrorMessage(stderr);
				return;
			};
			obj = JSON.parse(stdout);
			console.log(obj);
			this._onDidChangeTreeData.fire();
		});
	}

	getTreeItem(element: ArchetypeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: ArchetypeItem): Thenable<ArchetypeItem[]> {

		let array: ArchetypeItem[] = [];
		// for (var i = 0; obj && obj.objs && i < obj.objs.length; ++i) {
		// 	var lObj = obj.objs[i];
		// 	var label = lObj.id;
		// 	var formula = lObj.formula;
		// 	let lItem = new ArchetypeItem(label, formula);
		// 	array.push(lItem);
		// }

		return Promise.resolve(array);
	}

}

export class ArchetypeItem extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		private version: string,
		public readonly command?: vscode.Command
	) {
		super(label, vscode.TreeItemCollapsibleState.None);
	}

	get tooltip(): string {
		return `${this.label}-${this.version}`;
	}

	get description(): string {
		return this.version;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'formula.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'formula.svg')
	};

	contextValue = 'archetypeItem';

}
