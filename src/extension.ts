import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log("Archetype extension is active");
  let disposable = vscode.commands.registerCommand('archetype.compile', () => {
    vscode.window.showInformationMessage('Hello World 3!');
  });

  context.subscriptions.push(disposable);

  let genMarkdown = vscode.commands.registerTextEditorCommand('archetype.genMarkdown', editor => {
    if (editor.document.languageId !== 'archetype') {
      vscode.window.showErrorMessage('This command is for arl files only!');
      return;
    }

    if (vscode.window.activeTextEditor != undefined) {
      let fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
      let outputFsPath = fsPath.replace(/arl$/, "md");

      let cp = require('child_process');
      cp.exec('archetype -t markdown ' + fsPath + ' > ' + outputFsPath, (_err: string,stdout: string, stderr: string) => {
        if (_err) {
          vscode.window.showErrorMessage(stderr);
          return;
        }
        let outputUri = vscode.Uri.file(outputFsPath);
        vscode.window.showTextDocument(outputUri)
        .then(() => vscode.commands.executeCommand("markdown.showPreviewToSide"));
      });
    }
  });

  context.subscriptions.push(genMarkdown);

}

export function deactivate() { }