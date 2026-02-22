import { spawn } from 'child_process';
import * as vscode from 'vscode';

export interface DotnetEfResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface DbContextListResult {
  success: boolean;
  contexts: string[];
  errorMessage?: string;
  raw: DotnetEfResult;
}

interface RunDotnetEfOptions {
  cwd?: string;
  output?: vscode.OutputChannel;
}

export async function runDotnetEf(
  efArgs: string[],
  options: RunDotnetEfOptions = {}
): Promise<DotnetEfResult> {
  const args = ['ef', ...efArgs];
  const { cwd, output } = options;

  output?.appendLine(`> dotnet ${args.map(quoteForDisplay).join(' ')}`);
  if (cwd) {
    output?.appendLine(`cwd: ${cwd}`);
  }

  return new Promise<DotnetEfResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let spawnErrorMessage: string | undefined;

    const child = spawn('dotnet', args, {
      cwd,
      shell: false
    });

    child.stdout.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      stdout += text;
      output?.append(text);
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      const text = chunk.toString();
      stderr += text;
      output?.append(text);
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      spawnErrorMessage = error.code === 'ENOENT'
        ? 'The "dotnet" executable was not found. Install the .NET SDK and ensure it is in PATH.'
        : (error.message || 'Unknown error while starting dotnet.');

      stderr += `${spawnErrorMessage}\n`;
      output?.appendLine(spawnErrorMessage);
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}

interface ListDbContextsParams {
  projectPath: string;
  startupProjectPath: string;
  cwd?: string;
  output?: vscode.OutputChannel;
}

export async function listDbContexts(params: ListDbContextsParams): Promise<DbContextListResult> {
  const result = await runDotnetEf(
    [
      'dbcontext',
      'list',
      '--project',
      params.projectPath,
      '--startup-project',
      params.startupProjectPath
    ],
    {
      cwd: params.cwd,
      output: params.output
    }
  );

  const contexts = parseDbContextList(result.stdout);

  if (result.exitCode !== 0) {
    return {
      success: false,
      contexts: [],
      errorMessage: result.stderr.trim() || 'dotnet ef dbcontext list failed.',
      raw: result
    };
  }

  if (contexts.length === 0) {
    return {
      success: false,
      contexts: [],
      errorMessage: 'No DbContext names could be parsed from "dotnet ef dbcontext list" output.',
      raw: result
    };
  }

  return {
    success: true,
    contexts,
    raw: result
  };
}

interface AddMigrationParams {
  migrationName: string;
  projectPath: string;
  startupProjectPath: string;
  outputDir: string;
  dbContext: string;
  cwd?: string;
  output?: vscode.OutputChannel;
}

export async function addMigration(params: AddMigrationParams): Promise<DotnetEfResult> {
  return runDotnetEf(
    [
      'migrations',
      'add',
      params.migrationName,
      '--project',
      params.projectPath,
      '--startup-project',
      params.startupProjectPath,
      '--output-dir',
      params.outputDir,
      '--context',
      params.dbContext
    ],
    {
      cwd: params.cwd,
      output: params.output
    }
  );
}

function parseDbContextList(stdout: string): string[] {
  const ignoredExact = new Set([
    'Build started...',
    'Build succeeded.',
    'Build FAILED.'
  ]);

  const contexts = new Set<string>();

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (ignoredExact.has(line)) {
      continue;
    }
    if (line.startsWith('warn:') || line.startsWith('info:')) {
      continue;
    }
    if (/\s/.test(line)) {
      continue;
    }

    contexts.add(line);
  }

  return [...contexts];
}

function quoteForDisplay(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}
