/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */


import * as vscode from 'vscode';

import { ArchetypeNodeProvider, ArchetypeItem } from './archetypePropertiesExplorer';
import { registerCommands } from './commands';
import { startClient, stopClient } from './lsp';

export function activate(context: vscode.ExtensionContext) {
	// console.log("Archetype extension is active");

	const nodeArchetypePropertieExplorerProvider = new ArchetypeNodeProvider();
	context.subscriptions.push(vscode.window.registerTreeDataProvider('archetypePropertiesExplorer', nodeArchetypePropertieExplorerProvider));

	context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.refreshEntry', () => nodeArchetypePropertieExplorerProvider.refresh()));
	// context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.addEntry', () => vscode.window.showInformationMessage(`Successfully called add entry.`)));
	// context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.editEntry', (node: ArchetypeItem) => vscode.window.showInformationMessage(`Successfully called edit entry on ${node.label}.`)));
	// context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.deleteEntry', (node: ArchetypeItem) => vscode.window.showInformationMessage(`Successfully called delete entry on ${node.label}.`)));

	registerCommands(context);
	startClient(context);
}

export function deactivate(): Thenable<void> | undefined {
	return stopClient();
}
