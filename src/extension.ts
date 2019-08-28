import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log("Archetype extension is active");
  let disposable = vscode.commands.registerCommand('archetype.compile', () => {
    vscode.window.showInformationMessage('Hello World 3!');
  });

  context.subscriptions.push(disposable);

  let genDocument = function(editor: vscode.TextEditor, target: string, fileExtension: string, action: string) {
    if (editor.document.languageId !== 'archetype') {
      vscode.window.showErrorMessage('This command is for arl files only!');
      return;
    }
    if (vscode.window.activeTextEditor != undefined) {
      let fsPath = vscode.window.activeTextEditor.document.uri.fsPath;
      let outputFsPath = fsPath.replace(/arl$/, fileExtension);
      let cp = require('child_process');
      cp.exec('archetype -t ' + target + ' ' + fsPath + ' > ' + outputFsPath, (_err: string,stdout: string, stderr: string) => {
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
          cp2.exec('xargs python -m webbrowser < ' + outputFsPath, (_err: string,stdout: string, stderr: string) => {
            if (_err) {
              vscode.window.showErrorMessage(stderr);
              return;
            }
          });
        }
      });
    }
  };

  let targets = [
    { cmd: "genMarkdown", target: "markdown", ext: "md", action: "showPreviewToSide" },
    { cmd: "genLiquidityUrl", target: "liquidity_url", ext: "url", action: "openUrl" },
    { cmd: "genLiquidity", target: "liquidity", ext: "liq", action: "openFile" },
    { cmd: "genLigo", target: "ligo", ext: "lig", action: "openFile" },
    { cmd: "genSmartPy", target: "smartpy", ext: "spy", action: "openFile" },
    { cmd: "genOCaml", target: "ocaml", ext: "ml", action: "openFile"},
    { cmd: "genWhyml", target: "whyml", ext: "wml", action: "openFile"}
  ];

  targets.forEach( (target) => {
    let genTarget = vscode.commands.registerTextEditorCommand('archetype.' + target.cmd, editor => {
      genDocument(editor, target.target, target.ext, target.action);
    });
    context.subscriptions.push(genTarget);
  });
}

export function deactivate() { }