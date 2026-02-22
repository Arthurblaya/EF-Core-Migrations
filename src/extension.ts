import * as vscode from 'vscode';
import { runAddMigrationWizard } from './ui/wizard';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('EF Core Migrations');

  const command = vscode.commands.registerCommand('efcore.addMigrationWizard', async () => {
    try {
      await runAddMigrationWizard({ output });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.show(true);
      output.appendLine('=== Process finished with unexpected error ===');
      output.appendLine(`Unexpected error: ${message}`);
      void vscode.window.showErrorMessage(
        `EF Core Migrations failed: ${message}`
      );
    }
  });

  context.subscriptions.push(output, command);
}

export function deactivate(): void {
  // No-op
}
