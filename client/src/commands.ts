import * as vscode from 'vscode';
import * as archetype from '@completium/archetype';
import * as child_process from 'child_process';
import * as fs from 'fs';

export function registerCommands(context: vscode.ExtensionContext) {

	const genDocument = function (editor: vscode.TextEditor, target: string, fileExtension: string, action: string) {
		if (editor.document.languageId !== 'archetype') {
			vscode.window.showErrorMessage('This command is for arl files only!');
			return;
		}
		if (vscode.window.activeTextEditor != undefined) {
			const config = vscode.workspace.getConfiguration('archetype');
			const archetypeMode: string = config.get('archetypeMode');
			const caller: string = config.get('archetypeCallerAddress');
			const fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
			const outputFsPath = fsPath.replace(/arl$/, fileExtension);
			const cb = (error: child_process.ExecException | null, stdout: string, stderr: string) => {
				if (error !== null) {
					vscode.window.showErrorMessage(stderr);
					return;
				}
				const outputUri = vscode.Uri.file(outputFsPath);
				if (action == "openFile") {
					vscode.window.showTextDocument(outputUri);
				} else if (action == "openFileAndPreview") {
					vscode.window.showTextDocument(outputUri)
						.then(() => vscode.commands.executeCommand("markdown.showPreviewToSide"));
				} else if (action == "openUrl") {
					vscode.window.showErrorMessage("Open url");
					child_process.exec('xargs python -m webbrowser < ' + outputFsPath, (error: child_process.ExecException | null, stdout: string, stderr: string) => {
						if (error !== null) {
							vscode.window.showErrorMessage(stderr);
							return;
						}
					});
				}
			};
			if (archetypeMode == 'binary' || archetypeMode == 'docker') {
				const archetype_bin = config.get('archetypeBin');
				const cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
				const bin = archetypeMode == 'binary' ? archetype_bin : `docker run --platform=linux/amd64 --rm -v ${cwd}:${cwd} -w ${cwd} completium/archetype:latest`;
				const cmd = bin + ' --set-caller-init=' + caller + ' -t ' + target + ' ' + fsPath + ' > ' + outputFsPath;
				child_process.exec(cmd, cb);
			} else {
				const path = vscode.window.activeTextEditor.document.uri.path;
				const settings = {
					target: target,
					caller: caller
				};
				try {
					const res = archetype.compile(path, settings);
					fs.writeFile(outputFsPath, res, 'utf8', (() => cb(null, null, null)));
				} catch (e) {
					vscode.window.showErrorMessage(e);
				}
			}
		}
	};

	const openWhy3Ide = function (editor: vscode.TextEditor) {
		if (editor.document.languageId !== 'archetype') {
			vscode.window.showErrorMessage('This command is for arl files only!');
			return;
		}
		const fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
		const inputFsPath = fsPath.replace(/arl$/, "mlw");
		const config = vscode.workspace.getConfiguration('archetype');
		const pathWhy3Lib: string = config.get('archetypeWhy3Lib');
		const cmd = 'pkill why3ide; why3 ide -L ' + pathWhy3Lib + ' ' + inputFsPath;
		child_process.exec(cmd, (error: child_process.ExecException | null, stdout: string, stderr: string) => {
			if (error !== null) {
				vscode.window.showErrorMessage(stderr);
				return;
			}
		});
	};

	const decompile = function (editor: vscode.TextEditor) {
		if (editor.document.languageId !== 'michelson') {
			vscode.window.showErrorMessage('This command is for tz files only!');
			return;
		}
		if (vscode.window.activeTextEditor != undefined) {
			const config = vscode.workspace.getConfiguration('archetype');
			const archetypeMode: string = config.get('archetypeMode');

			const fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
			const outputFsPath = fsPath.replace(/tz$/, "d.arl");

			if (archetypeMode == 'binary' || archetypeMode == 'docker') {
				const archetype_bin = config.get('archetypeBin');
				const cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
				const bin = archetypeMode == 'binary' ? archetype_bin : `docker run --platform=linux/amd64 --rm -v ${cwd}:${cwd} -w ${cwd} completium/archetype:latest`;
				const cmd = bin + ' -d ' + fsPath + ' > ' + outputFsPath;
				child_process.exec(cmd, (error: child_process.ExecException | null, stdout: string, stderr: string) => {
					if (error !== null) {
						vscode.window.showErrorMessage(stderr);
						return;
					}
					const outputUri = vscode.Uri.file(outputFsPath);
					vscode.window.showTextDocument(outputUri);
				});
			} else {
				const text = vscode.window.activeTextEditor.document.getText();

				const res = archetype.decompile(text, {});
				fs.writeFile(outputFsPath, res, 'utf8', (() => {
					const outputUri = vscode.Uri.file(outputFsPath);
					vscode.window.showTextDocument(outputUri);
				}));
			}
		}
	};

	const targets = [
		// { cmd: "genMarkdown", target: "markdown", ext: "md", action: "showPreviewToSide" },
		{ cmd: "genTz", target: "michelson", ext: "tz", action: "openFile" },
		{ cmd: "genTzStorage", target: "michelson-storage", ext: "storage.tz", action: "openFile" },
		{ cmd: "genJavascript", target: "javascript", ext: "js", action: "openFile" },
		{ cmd: "genMarkdown", target: "markdown", ext: "md", action: "openFile" },
		{ cmd: "genWhyml", target: "whyml", ext: "mlw", action: "openFile" }
	];

	targets.forEach((target) => {
		const genTarget = vscode.commands.registerTextEditorCommand('archetype.' + target.cmd, editor => {
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
