import * as vscode from 'vscode';

export function registerCommands(context: vscode.ExtensionContext) {

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

	let genDocumentTzLigoStorage = function (editor: vscode.TextEditor) {
		if (editor.document.languageId !== 'archetype') {
			vscode.window.showErrorMessage('This command is for arl files only!');
			return;
		}
		let fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
		let sPath = fsPath.replace(/arl$/, "storage.ligo");
		let cmd0 = 'cat ' + sPath;
		let cp0 = require('child_process');
		cp0.exec(cmd0, (_err: string, stdout: string, stderr: string) => {
			if (_err) {
				vscode.window.showErrorMessage(stderr);
				return;
			};
			let storage = stdout;
			let inputFsPath = fsPath.replace(/arl$/, "ligo");
			let outputFsPath = fsPath.replace(/arl$/, "storage.tz");
			let cmd = 'ligo compile-storage ' + inputFsPath + ' main \'' + storage + '\' > ' + outputFsPath;
			let cp = require('child_process');
			cp.exec(cmd, (_err: string, stdout: string, stderr: string) => {
				if (_err) {
					vscode.window.showErrorMessage(stderr);
					return;
				};
				let outputUri = vscode.Uri.file(outputFsPath);
				vscode.window.showTextDocument(outputUri);
			});
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

	context.subscriptions.push(vscode.commands.registerTextEditorCommand('archetype.genTzLigoStorage', editor => {
		genDocument(editor, "ligo", "ligo", "openFile");
		genDocument(editor, "ligo-storage", "storage.ligo", "openFile");
		genDocumentTzLigoStorage(editor);
	}));

	context.subscriptions.push(vscode.commands.registerTextEditorCommand('archetype.verifyWhy3', editor => {
		genDocument(editor, "whyml", "mlw", "openFile");
		openWhy3Ide(editor);
	}));
}
