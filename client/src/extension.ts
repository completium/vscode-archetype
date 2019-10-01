/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as vscode from 'vscode';

import {
	ConfigurationParams,
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient';

import { ArchetypeNodeProvider, ArchetypeItem } from './archetypePropertiesExplorer';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
	console.log("Archetype extension is active");

	const nodeArchetypePropertieExplorerProvider = new ArchetypeNodeProvider(vscode.workspace.rootPath);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('archetypePropertiesExplorer', nodeArchetypePropertieExplorerProvider));

	// context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.refreshEntry', () => nodeArchetypePropertieExplorerProvider.refresh()));
	// context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.addEntry', () => vscode.window.showInformationMessage(`Successfully called add entry.`)));
	// context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.editEntry', (node: ArchetypeItem) => vscode.window.showInformationMessage(`Successfully called edit entry on ${node.label}.`)));
	// context.subscriptions.push(vscode.commands.registerCommand('archetypePropertiesExplorer.deleteEntry', (node: ArchetypeItem) => vscode.window.showInformationMessage(`Successfully called delete entry on ${node.label}.`)));

	let genDocument = function (editor: vscode.TextEditor, target: string, fileExtension: string, action: string) {
		if (editor.document.languageId !== 'archetype') {
			vscode.window.showErrorMessage('This command is for arl files only!');
			return;
		}
		if (vscode.window.activeTextEditor != undefined) {
			let fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
			let outputFsPath = fsPath.replace(/arl$/, fileExtension);
			let cp = require('child_process');
			let cmd = 'archetype -t ' + target + ' ' + fsPath + ' > ' + outputFsPath;
			cp.exec(cmd, (_err: string, stdout: string, stderr: string) => {
				if (_err) {
					vscode.window.showErrorMessage(stderr);
					return;
				}
				let outputUri = vscode.Uri.file(outputFsPath);
				if (action == "openFile") {
					vscode.window.showTextDocument(outputUri);
				} else if (action == "openFileAndPreview") {
					vscode.window.showTextDocument(outputUri)
						.then(() => vscode.commands.executeCommand("markdown.showPreviewToSide"));
				} else if (action == "openUrl") {
					vscode.window.showErrorMessage("Open url");
					let cp2 = require('child_process');
					cp2.exec('xargs python -m webbrowser < ' + outputFsPath, (_err: string, stdout: string, stderr: string) => {
						if (_err) {
							vscode.window.showErrorMessage(stderr);
							return;
						}
					});
				}
			});
		}
	};

	let genDocumentTzLigo = function (editor: vscode.TextEditor) {
		if (editor.document.languageId !== 'archetype') {
			vscode.window.showErrorMessage('This command is for arl files only!');
			return;
		}
		let fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
		let inputFsPath = fsPath.replace(/arl$/, "ligo");
		let outputFsPath = fsPath.replace(/arl$/, "tz");
		let cmd = 'ligo compile-contract ' + inputFsPath + ' main > ' + outputFsPath;
		let cp = require('child_process');
		cp.exec(cmd, (_err: string, stdout: string, stderr: string) => {
			if (_err) {
				vscode.window.showErrorMessage(stderr);
				return;
			};
			let outputUri = vscode.Uri.file(outputFsPath);
			vscode.window.showTextDocument(outputUri);
		});
	}

	let openWhy3Ide = function (editor: vscode.TextEditor) {
		if (editor.document.languageId !== 'archetype') {
			vscode.window.showErrorMessage('This command is for arl files only!');
			return;
		}
		let cp0 = require('child_process');
		let fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
		let inputFsPath = fsPath.replace(/arl$/, "mlw");
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

	let targets = [
		// { cmd: "genMarkdown", target: "markdown", ext: "md", action: "showPreviewToSide" },
		{ cmd: "genMarkdown", target: "markdown", ext: "md", action: "openFile" },
		{ cmd: "genLigo", target: "ligo", ext: "ligo", action: "openFile" },
		{ cmd: "genSmartPy", target: "smartpy", ext: "py", action: "openFile" },
		{ cmd: "genOCaml", target: "ocaml", ext: "ml", action: "openFile" },
		{ cmd: "genWhyml", target: "whyml", ext: "mlw", action: "openFile" }
	];

	targets.forEach((target) => {
		let genTarget = vscode.commands.registerTextEditorCommand('archetype.' + target.cmd, editor => {
			genDocument(editor, target.target, target.ext, target.action);
		});
		context.subscriptions.push(genTarget);
	});

	context.subscriptions.push(vscode.commands.registerTextEditorCommand('archetype.genTzLigo', editor => {
		genDocument(editor, "ligo", "ligo", "openFile");
		genDocumentTzLigo(editor);
	}));

	context.subscriptions.push(vscode.commands.registerTextEditorCommand('archetype.verifyWhy3', editor => {
		genDocument(editor, "whyml", "mlw", "openFile");
		openWhy3Ide(editor);
	}));

	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'archetype' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
