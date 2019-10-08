(function () {
    console.log("start");

    const vscode = acquireVsCodeApi();

    document.getElementById("verify_button").addEventListener('click', event => {
        console.log("verify");
        vscode.postMessage({
            command: 'alert',
            text: 'verify'
        });
    }, true);
}());
