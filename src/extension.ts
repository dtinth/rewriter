import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("rewriter.setApiKey", async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: "Please enter the API key generated from Google AI Studio",
        placeHolder: "API Key",
        password: true,
        ignoreFocusOut: true,
      });
      if (!apiKey) {
        return;
      }
      await context.secrets.store("rewriter.apiKey", apiKey);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("rewriter.rewrite", async (args) => {
      const task = vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Rewriting...",
          cancellable: false,
        },
        async (progress) => {
          const apiKey = await context.secrets.get("rewriter.apiKey");
          if (!apiKey) {
            vscode.window.showErrorMessage(
              "Please set the API key first by running the command Rewriter: Set API Key"
            );
            return;
          }

          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showErrorMessage("No active editor found");
            return;
          }

          const selection = editor.selection;
          const text = editor.document.getText(selection);
          if (!text) {
            vscode.window.showErrorMessage("No text selected");
            return;
          }

          const parts: { text: string }[] = [];
          parts.push({
            text:
              args?.prompt ||
              "Please rewrite the text to improve its grammar and readability",
          });
          const examples: { input: string; output: string }[] =
            args?.examples || [
              {
                input:
                  "Wildcard can capture the value after segment regardless of amount by using `*`.",
                output:
                  "Using `*` as a wildcard allows capturing any value after a segment, irrespective of its length or content.",
              },
              {
                input: "This library is build on top of web standards.",
                output: "This library is built on top of web standards.",
              },
            ];
          if (Array.isArray(examples)) {
            for (const example of examples) {
              parts.push({ text: `input: ${example?.input}` });
              parts.push({ text: `output: ${example?.output}` });
            }
          }
          parts.push({ text: `input: ${text}` });
          parts.push({ text: `output: ` });

          const request = {
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.9,
              topK: 1,
              topP: 1,
              maxOutputTokens: 2048,
              stopSequences: [],
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE",
              },
            ],
          };
          if (args?.debug) {
            console.log("Request to Gemini", request);
          }

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?${new URLSearchParams(
              { key: apiKey }
            )}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(request),
            }
          );
          const data = await response.json();
          if (args?.debug) {
            console.log("Response from Gemini", data);
          }

          const output = (data as any).candidates[0].content.parts
            .map((part: { text: string }) => part.text)
            .join("");
          await editor.edit((editBuilder) => {
            editBuilder.replace(selection, output);
          });
        }
      );
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
