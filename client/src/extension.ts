import * as vscode from 'vscode';
import { activateArchetypeDebug, workspaceFileAccessor } from './activateArchetypeDebug';

import { ArchetypePropertiesExplorer } from './archetypePropertiesExplorer';
import { registerCommands } from './commands';
import { startClient, stopClient } from './lsp';

export function activate(context: vscode.ExtensionContext) {
	//console.log("Archetype extension is active");

	activateArchetypeDebug(context);
	new ArchetypePropertiesExplorer(context);
	registerCommands(context);
	startClient(context);
}

export function deactivate(): Thenable<void> | undefined {
	return stopClient();
}
