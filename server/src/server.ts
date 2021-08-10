/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	createConnection,
	TextDocuments,
	TextDocument,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	DocumentSymbolParams,
	SymbolInformation,
	Location,
	Position,
	Range,
	SymbolKind
} from 'vscode-languageserver';
const { spawn } = require('child_process');
const archetype = require("@completium/archetype");

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
			documentSymbolProvider: true,
			// Tell the client that the server supports code completion
			completionProvider: {
				resolveProvider: true
			}
		}
	};
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface LSPSettings {
	useArchetypeJsLib : boolean;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: LSPSettings = { useArchetypeJsLib: true };
let globalSettings: LSPSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<LSPSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <LSPSettings>(
			(change.settings.archetype || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<LSPSettings> {
	// if (!hasConfigurationCapability) {
	// 	return Promise.resolve(globalSettings);
	// }
	// let result = documentSettings.get(resource);
	// if (!result) {
		let result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'archetype'
		});
	// 	documentSettings.set(resource, result);
	// }
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

function all(change) {
	symbols = []; // Ugly
	validateTextDocument(change.document);
	updateSymbols(change.document);
}

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	all(change);
});

function validateProcessing(textDocument: TextDocument, result: string) {
	interface Position {
		line: number;
		col: number;
		char: number;
	}

	interface Range {
		start: Position;
		end: Position;
	}

	interface Item {
		status: string[];
		range: Range;
		message: string;
	}

	interface Result {
		status: string[];
		items: Item[];
	}


	let obj: Result = JSON.parse(result);

	let diagnostics: Diagnostic[] = [];
	if (obj.status[0] === "Error") {
		for (var i = 0; i < obj.items.length; ++i) {
			var lItem = obj.items[i];

			let message = lItem.message;
			let start = lItem.range.start.char;
			let end = lItem.range.end.char;

			let diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: {
					start: textDocument.positionAt(start),
					end: textDocument.positionAt(end)
				},
				message: message,
				source: 'archetype'
			};
			diagnostics.push(diagnostic);
		}
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

function updateSymbolsProcessing(textDocument: TextDocument, result: string) {
	interface Position {
		line: number;
		col: number;
		char: number;
	}

	interface Outline {
		children: Outline[];
		name: string;
		kind: number;
		start: Position;
		end: Position;
	}

	interface ResultOutine {
		status: string[];
		outlines: Outline[];
	}


	function mk_outline(o: Outline): SymbolInformation {

		let res = SymbolInformation.create(
			o.name,
			o.kind as SymbolKind,
			Range.create(Position.create(o.start.line, o.start.col),
				Position.create(o.end.line, o.end.col)));


		return res;
	}

	let obj: ResultOutine = JSON.parse(result);

	for (var i = 0; i < obj.outlines.length; ++i) {
		var lOutline = obj.outlines[i];

		var a = mk_outline(lOutline);

		symbols.push(a);
	}
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	let settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	let text = textDocument.getText();

	if (settings.useArchetypeJsLib) {
		const res = await archetype.lsp("errors", text);
		validateProcessing(textDocument, res);
	} else {
		const { spawn } = require('child_process');
		const child = spawn('archetype', ['-lsp', 'errors']);

		child.stdin.setEncoding('utf8')
		child.stdin.write(text);
		child.stdin.end();

		child.stdout.on('data', (chunk) => {
			validateProcessing(textDocument, chunk);
		});
	}
}


let symbols: SymbolInformation[] = [];

async function updateSymbols(textDocument: TextDocument): Promise<void> {
  // In this simple example we get the settings for every validate run.
	let settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	let text = textDocument.getText();

	if (settings.useArchetypeJsLib) {
		const res = await archetype.lsp("outline", text);
		updateSymbolsProcessing(textDocument, res);
	} else {
		const { spawn } = require('child_process');
		const child = spawn('archetype', ['-lsp', 'outline']);

		child.stdin.setEncoding('utf8')
		child.stdin.write(text);
		child.stdin.end();

		child.stdout.on('data', (chunk) => {
			updateSymbolsProcessing(textDocument, chunk);
		});
	}
}


connection.onDidChangeWatchedFiles(change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
	all(change);
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
connection.onDocumentSymbol(
	(documentSymbolParams: DocumentSymbolParams): SymbolInformation[] => {
		return symbols;
	}
);


/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
