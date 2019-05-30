'use strict';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

  console.log('Congratulations, your extension "helloworld-sample" is now active!');

  context.subscriptions.push(vscode.commands.registerCommand('archetype.compile', () => {
    console.log(`Hello world!!!`);
  }));
}
