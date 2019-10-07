import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class ArchetypePropertiesExplorer {
	constructor(context: vscode.ExtensionContext) {
		const nodeArchetypePropertieExplorerProvider = new ArchetypeNodeProvider();
		context.subscriptions.push(vscode.window.registerTreeDataProvider('archetypePropertiesExplorer', nodeArchetypePropertieExplorerProvider));

		context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.refreshEntry', () => nodeArchetypePropertieExplorerProvider.refresh()));
		context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.process', (p: Property) => clickProperty(p)));
	}
}

export function clickProperty(p: Property) {
	// console.log("log: " + p.id);
	vscode.window.activeTextEditor.revealRange(
		new vscode.Range(
			p.location.start.line,
			p.location.start.col,
			p.location.end.line,
			p.location.end.col),
		vscode.TextEditorRevealType.Default);

	const panel = vscode.window.createWebviewPanel("", "Formula: " + p.id, vscode.ViewColumn.Two);
	panel.webview.html = `<!DOCTYPE html>
            <html lang="en">
            <head>
              <title>${p.id}</title>
            </head>
            <body>
							<p>Formula ${p.id}</p>
							<p>${p.formula}</p>
            </body>
            </html>`;
}

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
	obj: Property[];
}

let res: Result;

export class ArchetypeNodeProvider implements vscode.TreeDataProvider<ArchetypeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<ArchetypeItem | undefined> = new vscode.EventEmitter<ArchetypeItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<ArchetypeItem | undefined> = this._onDidChangeTreeData.event;

	constructor() {
	}

	refresh(): void {
		// console.log("refresh");
		if (vscode.window.activeTextEditor.document.languageId == "archetype") {
			let fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
			let cmd = 'archetype --service get_properties ' + fsPath;
			let cp = require('child_process');
			cp.exec(cmd, (_err: string, stdout: string, stderr: string) => {
				if (_err) {
					vscode.window.showErrorMessage(stderr);
					return;
				};
				res = JSON.parse(stdout);
				this._onDidChangeTreeData.fire();
			});
		} else {
			vscode.window.showErrorMessage("Not an archetype file.");
		}
	}

	getTreeItem(element: ArchetypeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: ArchetypeItem): Thenable<ArchetypeItem[]> {
		// console.log("getChildren");
		let array: ArchetypeItem[] = [];

		if (element) {
			// console.log("element");
		} else {
			// console.log("not_element");
			if (res) {
				// console.log("res");
				// console.log(res);
				if (res.status === ['Error']) {
					vscode.window.showErrorMessage("Error");
				} else {
					if (res.obj) {
						// console.log("obj.obj");
						for (var i = 0; i < res.obj.length; ++i) {
							var lObj = res.obj[i];

							var property = mk_property(lObj);
							array.push(property);
						}
					} else {
						// console.log("not obj.objs");
					}
				}
			} else {
				// console.log("not_obj");
			}
		};
		// this._onDidChangeTreeData.fire();
		return Promise.resolve(array);
	}
}

function mk_property(property: Property): ArchetypeItem {
	return new ArchetypeItem(property, {
		command: 'archetypePropertiesExplorer.process',
		title: '',
		arguments: [property]
	});
}

export class ArchetypeItem extends vscode.TreeItem {

	constructor(
		public readonly property: Property,
		public readonly command: vscode.Command
	) {
		super(property.id, vscode.TreeItemCollapsibleState.None);
	}

	get tooltip(): string {
		return `${this.property.id}`;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'images', 'formula_light.svg'),
		dark: path.join(__filename, '..', '..', 'images', 'formula_dark.svg')
	};

	contextValue = 'archetypeItem';

}
