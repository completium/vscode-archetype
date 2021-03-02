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
  		const config = vscode.workspace.getConfiguration('archetype');
  		const caller: string = config.get('archetypeCallerAddress');
			let cmd = 'archetype ' + '--set-caller-init=' + caller + ' -t ' + target + ' ' + fsPath + ' > ' + outputFsPath;
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

	let decompile = function (editor: vscode.TextEditor) {
		if (editor.document.languageId !== 'michelson') {
			vscode.window.showErrorMessage('This command is for tz files only!');
			return;
		}
		if (vscode.window.activeTextEditor != undefined) {
			let fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
			let outputFsPath = fsPath.replace(/tz$/, "d.arl");
			let cp = require('child_process');
  		const config = vscode.workspace.getConfiguration('archetype');
  		const caller: string = config.get('archetypeCallerAddress');
			let cmd = 'archetype -d ' + fsPath + ' > ' + outputFsPath;
			cp.exec(cmd, (_err: string, stdout: string, stderr: string) => {
				if (_err) {
					vscode.window.showErrorMessage(stderr);
					return;
				}
				let outputUri = vscode.Uri.file(outputFsPath);
  			vscode.window.showTextDocument(outputUri);
			});
		}
	};

	let targets = [
		// { cmd: "genMarkdown", target: "markdown", ext: "md", action: "showPreviewToSide" },
		{ cmd: "genTz", target: "michelson", ext: "tz", action: "openFile" },
		{ cmd: "genTzStorage", target: "michelson-storage", ext: "storage.tz", action: "openFile" },
		{ cmd: "genJavascript", target: "javascript", ext: "js", action: "openFile" },
		{ cmd: "genMarkdown", target: "markdown", ext: "md", action: "openFile" },
		{ cmd: "genWhyml", target: "whyml", ext: "mlw", action: "openFile" }
	];

	targets.forEach((target) => {
		let genTarget = vscode.commands.registerTextEditorCommand('archetype.' + target.cmd, editor => {
			genDocument(editor, target.target, target.ext, target.action);
		});
		context.subscriptions.push(genTarget);
	});

	context.subscriptions.push(vscode.commands.registerTextEditorCommand('archetype.verifyWhy3', editor => {
		genDocument(editor, "whyml", "mlw", "openFile");
		openWhy3Ide(editor);
	}));

	context.subscriptions.push(vscode.commands.registerTextEditorCommand('archetype.decompile', editor => {
		decompile(editor);
	}));
}
