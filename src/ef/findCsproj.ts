import * as path from 'path';
import * as vscode from 'vscode';

export interface CsprojItem {
  uri: vscode.Uri;
  projectName: string;
  relativePath: string;
  workspaceFolderName?: string;
  workspaceFolderUri: vscode.Uri;
}

export async function findCsprojFiles(): Promise<CsprojItem[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const uris = await vscode.workspace.findFiles(
    '**/*.csproj',
    '**/{bin,obj,.git,node_modules}/**'
  );

  const items = uris
    .map<CsprojItem | undefined>((uri) => {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {
        return undefined;
      }

      const projectName = path.basename(uri.fsPath, '.csproj');
      const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath).replace(/\\/g, '/');

      return {
        uri,
        projectName,
        relativePath,
        workspaceFolderName: workspaceFolder.name,
        workspaceFolderUri: workspaceFolder.uri
      };
    })
    .filter((item): item is CsprojItem => item !== undefined);

  items.sort((a, b) => {
    const folderCompare = (a.workspaceFolderName ?? '').localeCompare(b.workspaceFolderName ?? '');
    if (folderCompare !== 0) {
      return folderCompare;
    }

    return a.relativePath.localeCompare(b.relativePath);
  });

  return items;
}
