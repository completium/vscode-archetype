import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import * as archetype from '@completium/archetype';
import * as child_process from 'child_process';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
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

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
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
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

interface LSPSettings {
	archetypeMode: string;
	archetypeBin: string;
}

function getDocumentSettings(resource: string): Thenable<LSPSettings> {
	// if (!hasConfigurationCapability) {
	// 	return Promise.resolve(globalSettings);
	// }
	// let result = documentSettings.get(resource);
	// if (!result) {
	const result = connection.workspace.getConfiguration({
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

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
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
		severity?: DiagnosticSeverity;
		status: string[];
		range: Range;
		message: string;
	}

	interface Result {
		status: string[];
		items: Item[];
	}

	const obj: Result = JSON.parse(result);

	const diagnostics: Diagnostic[] = [];
	if (obj.status[0] === "Crash") {
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: textDocument.positionAt(0),
				end: textDocument.positionAt(textDocument.getText().length),
			},
			message: "Reached JS compiler limit, please switch to binary compiler.\nFor information, visit https://archetype-lang.org/docs/installation#js-1",
			source: 'archetype'
		};
		diagnostics.push(diagnostic);
	} else if (obj.status[0] === "Error") {
		for (let i = 0; i < obj.items.length; ++i) {
			const lItem = obj.items[i];

			const message = lItem.message;
			const start = lItem.range.start.char;
			const end = lItem.range.end.char;
			const severity: DiagnosticSeverity = lItem.severity ? lItem.severity : DiagnosticSeverity.Error;

			const diagnostic: Diagnostic = {
				severity: severity,
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

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	const text = textDocument.getText();
	const url = new URL(textDocument.uri);
	const path_doc = url.pathname;

	if (settings.archetypeMode === 'binary' || settings.archetypeMode === 'docker') {

		const bin = settings.archetypeMode === 'binary' ? settings.archetypeBin : 'docker';
		const cwd = process.cwd();
		const args = settings.archetypeMode === 'binary' ? ['-lsp', 'errors', '--path', path_doc] : ['run', '-i', '--rm', '-v', `${cwd}:${cwd}`, '-w', `${cwd}`, 'completium/archetype:latest', '-lsp', 'errors', '--path', path_doc];

		const child = child_process.spawn(bin, args);

		child.stdin.setDefaultEncoding('utf8');
		child.stdin.write(text);
		child.stdin.end();

		let content : any[] = [];
		child.stdout.on('data', (chunk : string) => {
			content = content.concat(...chunk);
		});
		child.stdout.on('close', (code : number) => {
			if (code == 0 && content.length > 0) {
				validateProcessing(textDocument, Buffer.from(content).toString());
			}
		});
	} else {
		const res = await archetype.lsp("errors", path_doc, text);
		validateProcessing(textDocument, res);
	}
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
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

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
