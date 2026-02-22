# EF Core Migrations for VS Code

`EF Core Migrations` is a Visual Studio Code extension that helps you create **Entity Framework Core migrations** with a guided wizard instead of manually typing long `dotnet ef` commands.

If you work with **ASP.NET Core**, **.NET**, **Entity Framework Core**, and multi-project solutions, this extension streamlines the most common migration workflow directly inside VS Code.

## Why This Extension?

Creating EF Core migrations often requires remembering and typing command arguments such as:

- `--project`
- `--startup-project`
- `--output-dir`
- `--context`

This extension provides a **wizard-based migration flow** using VS Code `QuickPick` and `InputBox` steps so you can create migrations faster and with fewer mistakes.

## Features

### Add Migration Wizard (`efcore.addMigrationWizard`)

Guided flow for `dotnet ef migrations add`:

1. Select **Startup Project** (`--startup-project`)
2. Select **Target Project** (`--project`)
3. Enter **Migrations Output Directory** (`--output-dir`)
4. Enter **Migration Name**
5. Select **DbContext** (`--context`)

Additional behavior:

- Scans the current VS Code workspace for `.csproj` files
- Supports multi-root workspaces
- Automatically runs `dotnet ef dbcontext list` to detect available `DbContext` types
- Falls back to manual `DbContext` entry if automatic detection fails
- Streams command output to an **EF Core Migrations** output channel
- Shows success/error notifications in VS Code

## Requirements

Before using the extension, make sure you have:

- **.NET SDK** installed (`dotnet` available in `PATH`)
- **Entity Framework Core CLI tools** (`dotnet-ef`) installed and working
- A workspace containing one or more `.csproj` projects configured for EF Core

### Verify your environment

```bash
dotnet --version
dotnet ef --help
```

## How to Use

1. Open your solution/workspace in VS Code
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run: `EF Core Migrations: Add Migration Wizard`
4. Complete the wizard steps
5. Review logs in the `EF Core Migrations` output channel if needed

## What Command Gets Executed?

The wizard ultimately runs the EF Core CLI command equivalent to:

```bash
dotnet ef migrations add <MigrationName> \
  --project <TargetProject.csproj> \
  --startup-project <StartupProject.csproj> \
  --output-dir <Relative/Migrations/Folder> \
  --context <YourDbContext>
```

## Typical Use Cases

- Add EF Core migrations in **clean architecture** solutions
- Work with separate **API**, **Infrastructure**, and **Persistence** projects
- Reduce command-line mistakes in multi-project `.NET` repositories
- Speed up onboarding for developers new to EF Core CLI

## Troubleshooting

### `dotnet` not found

Install the .NET SDK and ensure `dotnet` is available in your system `PATH`.

### `DbContext` list fails

The extension will let you enter the `DbContext` name manually. You can also test directly:

```bash
dotnet ef dbcontext list --project <TargetProject.csproj> --startup-project <StartupProject.csproj>
```

### No `.csproj` files found

Make sure you opened the correct folder/workspace in VS Code and that your projects are inside the workspace root(s).
