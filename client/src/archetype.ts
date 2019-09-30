import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class AaaNodeProvider implements vscode.TreeDataProvider<Aaa> {

	private _onDidChangeTreeData: vscode.EventEmitter<Aaa | undefined> = new vscode.EventEmitter<Aaa | undefined>();
	readonly onDidChangeTreeData: vscode.Event<Aaa | undefined> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string) {
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Aaa): vscode.TreeItem {
		return element;
	}

	getChildren(element?: Aaa): Thenable<Aaa[]> {
		return Promise.resolve([]);
	}

	/**
	 * Given the path to package.json, read all its dependencies and devDependencies.
	 */
	private getDepsInPackageJson(packageJsonPath: string): Aaa[] {
		return [];
	}

	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}

		return true;
	}
}

export class Aaa extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		private version: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
	}

	get tooltip(): string {
		return `${this.label}-${this.version}`;
	}

	get description(): string {
		return this.version;
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	};

	contextValue = 'archetype';

}
