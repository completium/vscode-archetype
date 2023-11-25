import { ExtensionContext } from 'vscode';
import { stopClient, startClient } from './lsp';
import { registerCommands } from './commands';
import { activateArchetypeDebug } from './activateArchetypeDebug';

export function activate(context: ExtensionContext) {
	activateArchetypeDebug(context);
	registerCommands(context);
	startClient(context);
}

export function deactivate(): Thenable<void> | undefined {
	return stopClient();
}
