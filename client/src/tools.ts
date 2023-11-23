import * as child_process from 'child_process';
import * as vscode from 'vscode';
import * as utils from './utils';

export async function askOpen(prompt: string, placeHolder: string, def: string) : Promise<string | undefined> {
	const value = await vscode.window.showInputBox({
		prompt: prompt, // Le texte à afficher pour guider l'utilisateur
		placeHolder: placeHolder, // Texte affiché à l'intérieur de la zone de saisie
		value : def // Valeur par défaut déjà remplie
	});

	console.log(`${prompt} : ${value}`)
	return value
}

export async function askOpenValidate(prompt : string, placeHolder : string, def : string, validate : (string) => void) {
	let ko = true
	while(ko) {
		try {
			const v = await askOpen(prompt, placeHolder, def)
			validate(v)
			ko = false
		} catch (e) {
			if (e instanceof utils.InputError) {
				vscode.window.showErrorMessage(e.message)
				ko = true
			}
		}
	}
}

export async function askClosed(prompt : string, options : string[]) : Promise<string | undefined> {
	const value = await vscode.window.showQuickPick(options, {
		placeHolder: prompt, // Texte à afficher pour guider l'utilisateur
	});
	console.log(`${prompt} : ${value}`)
	return value
}

export function executeCommand(command: string, escape ?: string): Promise<string> {
	return new Promise((resolve, reject) => {
		child_process.exec(command, (error, stdout, stderr) => {
			if (error) {
				if (escape !== undefined && stderr != null && stderr.indexOf(escape)) {
					resolve(stderr);
				} else {
					vscode.window.showErrorMessage(`exec error: ${error}`)
					reject(error);
				}
				return;
			}
			if (stderr) {
				vscode.window.showErrorMessage(`stderr: ${stderr}`);
				reject(new Error(`Error executing command: ${stderr}`));
				return;
			}
			resolve(stdout);
		});
	});
}