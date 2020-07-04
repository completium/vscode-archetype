/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */


import * as vscode from 'vscode';

import { ArchetypeNodeProvider, ArchetypeItem, ArchetypePropertiesExplorer } from './archetypePropertiesExplorer';
import { registerCommands } from './commands';
import { startClient, stopClient } from './lsp';

export function activate(context: vscode.ExtensionContext) {
	// console.log("Archetype extension is active");

	new ArchetypePropertiesExplorer(context);
	registerCommands(context);
	startClient(context);
}

export function deactivate(): Thenable<void> | undefined {
	return stopClient();
}
