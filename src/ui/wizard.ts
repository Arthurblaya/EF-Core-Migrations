import * as vscode from 'vscode';
import { addMigration, listDbContexts } from '../ef/dotnetEf';
import { CsprojItem, findCsprojFiles } from '../ef/findCsproj';

export interface AddMigrationWizardDeps {
  output: vscode.OutputChannel;
}

interface ProjectPickItem extends vscode.QuickPickItem {
  project: CsprojItem;
}

export async function runAddMigrationWizard(deps: AddMigrationWizardDeps): Promise<void> {
  deps.output.appendLine('');
  deps.output.appendLine('=== EF Core Migrations Wizard started ===');

  const projects = await findCsprojFiles();
  if (projects.length === 0) {
    deps.output.appendLine('No .csproj files found in workspace.');
    void vscode.window.showErrorMessage(
      'No .csproj files were found in the current workspace.'
    );
    return;
  }

  const startupProject = await pickProject(projects, {
    title: 'EF Core Migrations: Select Startup Project',
    step: 1,
    totalSteps: 5,
    placeholder: 'Choose the startup project (--startup-project)'
  });
  if (!startupProject) {
    deps.output.appendLine('Wizard cancelled at step 1 (startup project).');
    return;
  }
  deps.output.appendLine(`Selected startup project: ${startupProject.project.uri.fsPath}`);

  const targetProject = await pickProject(projects, {
    title: 'EF Core Migrations: Select Target Project',
    step: 2,
    totalSteps: 5,
    placeholder: 'Choose the target project (--project)'
  });
  if (!targetProject) {
    deps.output.appendLine('Wizard cancelled at step 2 (target project).');
    return;
  }
  deps.output.appendLine(`Selected target project: ${targetProject.project.uri.fsPath}`);

  const outputDir = await vscode.window.showInputBox({
    prompt: 'Enter migrations output directory (--output-dir)',
    value: 'Persistence/Migrations',
    ignoreFocusOut: true,
    validateInput: validateOutputDir
  });
  if (outputDir === undefined) {
    deps.output.appendLine('Wizard cancelled at step 3 (output dir).');
    return;
  }
  deps.output.appendLine(`Selected output dir: ${outputDir}`);

  const migrationNameInput = await vscode.window.showInputBox({
    prompt: 'Enter migration name',
    placeHolder: 'InitialCreate',
    ignoreFocusOut: true,
    validateInput: validateMigrationName
  });
  if (migrationNameInput === undefined) {
    deps.output.appendLine('Wizard cancelled at step 4 (migration name).');
    return;
  }

  const migrationName = normalizeMigrationName(migrationNameInput);
  deps.output.appendLine(`Migration name input: ${migrationNameInput}`);
  deps.output.appendLine(`Normalized migration name: ${migrationName}`);
  const cwd = targetProject.project.workspaceFolderUri.fsPath;
  deps.output.appendLine(`Working directory (cwd): ${cwd}`);

  const dbContext = await pickDbContext({
    targetProject,
    startupProject,
    cwd,
    output: deps.output
  });
  if (!dbContext) {
    deps.output.appendLine('Wizard cancelled at step 5 (DbContext).');
    return;
  }
  deps.output.appendLine(`Selected DbContext: ${dbContext}`);

  deps.output.appendLine('');
  deps.output.appendLine('=== Add Migration Wizard ===');
  deps.output.appendLine(`Startup project: ${startupProject.project.uri.fsPath}`);
  deps.output.appendLine(`Target project: ${targetProject.project.uri.fsPath}`);
  deps.output.appendLine(`Output dir: ${outputDir}`);
  deps.output.appendLine(`Migration name: ${migrationName}`);
  deps.output.appendLine(`DbContext: ${dbContext}`);

  deps.output.appendLine('Adding migration (running "dotnet ef migrations add")...');

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'EF Core Migrations',
      cancellable: false
    },
    async (progress) => {
      progress.report({ message: 'Adding migration...' });

      return addMigration({
        migrationName,
        projectPath: targetProject.project.uri.fsPath,
        startupProjectPath: startupProject.project.uri.fsPath,
        outputDir,
        dbContext,
        cwd,
        output: deps.output
      });
    }
  );

  if (result.exitCode !== 0) {
    deps.output.show(true);
    deps.output.appendLine(`Migration command failed with exit code ${result.exitCode}.`);
    deps.output.appendLine('=== Process finished with errors ===');
    if (result.stderr.trim()) {
      deps.output.appendLine('stderr summary:');
      deps.output.appendLine(result.stderr.trim());
    } else if (result.stdout.trim()) {
      deps.output.appendLine('stdout summary:');
      deps.output.appendLine(result.stdout.trim());
    }
    void vscode.window.showErrorMessage(
      `Failed to add migration (exit code ${result.exitCode}). Check the "EF Core Migrations" output for details.`
    );
    return;
  }

  deps.output.appendLine('Migration command completed successfully.');
  deps.output.appendLine('=== Process finished successfully ===');
  void vscode.window.showInformationMessage(`Migration "${migrationName}" created successfully.`);
}

async function pickProject(
  projects: CsprojItem[],
  options: {
    title: string;
    step: number;
    totalSteps: number;
    placeholder: string;
  }
): Promise<ProjectPickItem | undefined> {
  const isMultiRoot = (vscode.workspace.workspaceFolders?.length ?? 0) > 1;

  const items: ProjectPickItem[] = projects.map((project) => ({
    label: project.projectName,
    description: isMultiRoot && project.workspaceFolderName
      ? `[${project.workspaceFolderName}] ${project.relativePath}`
      : project.relativePath,
    project
  }));

  return vscode.window.showQuickPick<ProjectPickItem>(items, {
    placeHolder: options.placeholder,
    ignoreFocusOut: true,
    matchOnDescription: true
  });
}

async function pickDbContext(params: {
  targetProject: ProjectPickItem;
  startupProject: ProjectPickItem;
  cwd: string;
  output: vscode.OutputChannel;
}): Promise<string | undefined> {
  params.output.appendLine('Loading DbContexts (running "dotnet ef dbcontext list")...');

  const listResult = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'EF Core Migrations',
      cancellable: false
    },
    async (progress) => {
      progress.report({ message: 'Loading DbContexts...' });

      return listDbContexts({
        projectPath: params.targetProject.project.uri.fsPath,
        startupProjectPath: params.startupProject.project.uri.fsPath,
        cwd: params.cwd,
        output: params.output
      });
    }
  );

  if (listResult.success) {
    params.output.appendLine(`DbContexts detected: ${listResult.contexts.join(', ')}`);
    const selected = await vscode.window.showQuickPick(
      listResult.contexts.map((ctx) => ({ label: ctx })),
      {
        placeHolder: 'Choose DbContext (--context)',
        ignoreFocusOut: true
      }
    );

    if (!selected) {
      params.output.appendLine('DbContext QuickPick cancelled.');
      return undefined;
    }

    params.output.appendLine(`DbContext selected from QuickPick: ${selected.label}`);
    return selected.label;
  }

  params.output.appendLine(
    `Automatic DbContext detection failed: ${listResult.errorMessage ?? 'Unknown error'}`
  );
  params.output.show(true);
  params.output.appendLine('=== DbContext detection finished with errors (manual fallback enabled) ===');
  void vscode.window.showErrorMessage(
    'Failed to detect DbContexts automatically. Please enter the DbContext name manually.'
  );

  const manualContext = await vscode.window.showInputBox({
    prompt: 'Enter DbContext name (--context)',
    ignoreFocusOut: true,
    validateInput: (value) => value.trim() ? undefined : 'DbContext name cannot be empty.'
  });

  if (manualContext === undefined) {
    params.output.appendLine('Manual DbContext input cancelled.');
    return undefined;
  }

  const trimmed = manualContext.trim();
  params.output.appendLine(`DbContext entered manually: ${trimmed}`);
  return trimmed || undefined;
}

function validateOutputDir(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Output directory cannot be empty.';
  }
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    return 'Output directory must be a relative path and cannot start with "/" or "\\".';
  }
  if (trimmed.includes('..')) {
    return 'Output directory cannot contain "..".';
  }
  return undefined;
}

function validateMigrationName(value: string): string | undefined {
  if (!value.trim()) {
    return 'Migration name cannot be empty.';
  }
  return undefined;
}

function normalizeMigrationName(value: string): string {
  return value.trim().replace(/\s+/g, '_');
}
