import * as vscode from 'vscode';
import * as path from 'path';

export class ArchetypePropertiesExplorer {

	constructor(context: vscode.ExtensionContext) {
		const nodeArchetypePropertieExplorerProvider = new ArchetypeNodeProvider(context);

		context.subscriptions.push(vscode.window.registerTreeDataProvider('archetypePropertiesExplorer', nodeArchetypePropertieExplorerProvider));

		context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.refreshEntry', () => nodeArchetypePropertieExplorerProvider.refresh()));
		context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.process', (p: Property, e: string) => this.clickProperty(p, e)));
		context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.verify', (item: ArchetypeItem) => this.clickVerify(item)));
		context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.generateMlwFileOne', (item: ArchetypeItem) => this.generateMlwFileOne(item)));
		context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.generateMlwFileAll', () => this.generateMlwFileAll()));

		vscode.window.onDidChangeVisibleTextEditors(() => nodeArchetypePropertieExplorerProvider.doRefresh());
		vscode.workspace.onDidSaveTextDocument(() => nodeArchetypePropertieExplorerProvider.doRefresh());
	}

	private generateMlwFileIntern(f: { (path: string): void }, item?: ArchetypeItem) {
		console.log(item);
		let fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
		let path = fsPath.replace(/.arl$/, '');
		let postfix = item ? '_' + item.property.id : '';
		let tmp = path + postfix + '.mlw';
		const config = vscode.workspace.getConfiguration('archetype');
		const caller: string = config.get('archetypeCallerAddress');
		let fp = item ? ' -fp ' + item.property.id : '';
		let cmd = 'archetype' + ' --set-caller-init=' + caller + fp + ' -t whyml ' + fsPath + ' > ' + tmp;
		let cp = require('child_process');
		cp.exec(cmd, (_err: string, stdout: string, stderr: string) => {
			if (_err) {
				vscode.window.showErrorMessage(stderr);
			} else {
				f(tmp);
			}
		});
	}

	private clickVerify(item: ArchetypeItem) {
		this.generateMlwFileIntern(this.openWhy3Ide, item);
	}

	private openFile(path: string) {
		let outputUri = vscode.Uri.file(path);
		vscode.window.showTextDocument(outputUri);
	}

	private generateMlwFileOne(item: ArchetypeItem) {
		this.generateMlwFileIntern(this.openFile, item);
	}

	private generateMlwFileAll() {
		this.generateMlwFileIntern(this.openFile);
	}

	private openWhy3Ide(inputFsPath: string) {
		const config = vscode.workspace.getConfiguration('archetype');
		const pathWhy3Lib: string = config.get('archetypeWhy3Lib');
		let cmd = 'pkill why3ide; why3 ide -L ' + pathWhy3Lib + ' ' + inputFsPath;
		let cp = require('child_process');
		cp.exec(cmd, (_err: string, stdout: string, stderr: string) => {
			if (_err) {
				vscode.window.showErrorMessage(stderr);
				return;
			};
		});
	}

	private clickProperty(p: Property, extensionPath: string) {
		// console.log("log: " + p.id);
		const range = new vscode.Range(
			p.location.start.line,
			0,
			p.location.end.line + 1,
			0);

		vscode.window.activeTextEditor.

			revealRange(
				range,
				vscode.TextEditorRevealType.Default);

		// if (this.decoration) {
		// 	this.decoration.dispose();
		// }

		// this.decoration = vscode.window.createTextEditorDecorationType(
		// 	{
		// 		light: { backgroundColor: "rgba(16, 207, 201, 0.3)" },
		// 		dark: { backgroundColor: "rgba(16, 207, 201, 0.3)" }
		// 	});

		// vscode.window.activeTextEditor.setDecorations(this.decoration, [range]);
	}

	createWebviewPanel(p: Property, extensionPath: string) {
		const panel = vscode.window.createWebviewPanel("", "Formula: " + p.id, vscode.ViewColumn.Two,
			{
				// Enable javascript in the webview
				enableScripts: true,

				// And restrict the webview to only loading content from our extension's `media` directory.
				localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'resources'))]
			});
		const webview = panel.webview;

		let invs =
			p.invariants.length == 0 ? "" : `<p>Invariants</p><p> </p>`

		const scriptPathOnDisk = vscode.Uri.file(
			path.join(extensionPath, 'resources', 'script_ape.js')
		);


		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		webview.html = `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">

                <!--
                Use a content security policy to only allow loading images from https or from our extension directory,
                and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Formula ${p.id}</title>
            </head>
            <body>
							<h2>Archetype property ${p.id}</h2>
							<p>${p.formula}</p>
							<button id="verify_button">Verify</button>
							<script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;

		webview.onDidReceiveMessage(
			message => {
				console.log("onDidReceiveMessage");
				switch (message.command) {
					case 'alert':
						vscode.window.showInformationMessage(message.text);
						return;
				}
			},
			null,
			[]
		);
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
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

interface Invariant {
	label: string;
	formulas: string[];
}

interface Property {
	kind: string[];
	id: string;
	formula: string;
	invariants: Invariant[];
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

	constructor(
		public readonly context: vscode.ExtensionContext) {
	}

	refresh(): void {
		// console.log("refresh");
		if (vscode.window.activeTextEditor.document.languageId == "archetype") {
			this.doRefresh();
		} else {
			vscode.window.showErrorMessage("Not an archetype file.");
		}
	}

	doRefresh(): void {
		if (vscode.window.activeTextEditor.document.languageId == "archetype") {
			const config = vscode.workspace.getConfiguration('archetype');
			const archetypeMode: string = config.get('archetypeMode');

			if (archetypeMode == 'binary' || archetypeMode == 'docker') {
				let fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
				const archetype_bin = config.get('archetypeBin');
				const cwd = process.cwd();
				const bin = archetypeMode == 'binary' ? archetype_bin : `docker run --rm -v ${cwd}:${cwd} -w ${cwd} completium/archetype:latest`;
				let cmd = bin + ' --service get_properties ' + fsPath;
				let cp = require('child_process');
				cp.exec(cmd, (_err: string, stdout: string, stderr: string) => {
					if (_err) {
						vscode.window.showErrorMessage(stderr);
						res = undefined;
					} else {
						res = JSON.parse(stdout);
					}
					this._onDidChangeTreeData.fire();
				});
			} else {
				const archetype = require('@completium/archetype');
				let text = vscode.window.activeTextEditor.document.getText();
				const json = archetype.services("get_properties", text)
				res = JSON.parse(json);
				this._onDidChangeTreeData.fire();
			}

		} else {
			res = undefined;
			this._onDidChangeTreeData.fire();
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

							var property = mk_property(lObj, this.context.extensionPath);
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


export class ArchetypeItem extends vscode.TreeItem {

	constructor(
		public readonly property: Property,
		public readonly _extensionPath: string,
		public readonly command: vscode.Command
	) {
		super(property.id, vscode.TreeItemCollapsibleState.None);
		this.description = property.formula;
	}

	// get tooltip(): string {
	// 	return `${this.property.id}`;
	// }

	// iconPath = {
	// 	light: path.join(this._extensionPath, 'images', 'formula_light.svg'),
	// 	dark: path.join(this._extensionPath, 'images', 'formula_dark.svg')
	// };

	contextValue = 'archetypeItem';

}

function mk_property(property: Property, extensionPath: string): ArchetypeItem {

	return new ArchetypeItem(property, extensionPath,
		{
			command: 'archetypePropertiesExplorer.process',
			title: '',
			arguments: [property, extensionPath]
		}
	);
}