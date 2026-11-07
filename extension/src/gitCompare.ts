import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { AnalyzerError, runAnalyzer } from './analyzerRunner';
import type { AtlasGraph } from './types';

/** What the user can compare the open map with. */
export interface Revision {
  /** Branch, tag or abbreviated commit as shown to the user. */
  label: string;
  /** Full commit id. */
  commit: string;
}

/** Runs git without a shell, so nothing the user types is interpreted. */
function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.execFile('git', args, { cwd, maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new AnalyzerError(`git ${args[0]} failed: ${(stderr || error.message).trim()}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

export async function repositoryRoot(directory: string): Promise<string> {
  try {
    return path.normalize((await git(directory, ['rev-parse', '--show-toplevel'])).trim());
  } catch {
    throw new AnalyzerError('The solution is not inside a Git repository, so there is nothing to compare with.');
  }
}

/** A name that git can resolve and that cannot be taken for an option. */
const REVISION_NAME = /^[A-Za-z0-9][A-Za-z0-9._/~^@{}:-]*$/;

async function resolveCommit(root: string, name: string): Promise<string | undefined> {
  if (!REVISION_NAME.test(name)) {
    return undefined;
  }

  try {
    return (await git(root, ['rev-parse', '--verify', '--quiet', `${name}^{commit}`])).trim() || undefined;
  } catch {
    return undefined;
  }
}

interface RevisionItem extends vscode.QuickPickItem {
  name?: string;
}

/** Lets the user choose a branch, a tag or a recent commit, or type any revision git understands. */
export async function pickRevision(root: string): Promise<Revision | undefined> {
  const items: RevisionItem[] = [{ label: 'Enter a commit, branch or tag…', name: undefined, alwaysShow: true }];

  const refs = await git(root, [
    'for-each-ref',
    '--sort=-committerdate',
    '--count=60',
    '--format=%(refname:short)%09%(objectname:short)%09%(contents:subject)',
    'refs/heads',
    'refs/remotes',
    'refs/tags',
  ]).catch(() => '');

  items.push({ label: 'Branches and tags', kind: vscode.QuickPickItemKind.Separator });
  for (const line of refs.split('\n').filter(Boolean)) {
    const [name, short, subject] = line.split('\t');
    if (name && !name.endsWith('/HEAD')) {
      items.push({ label: name, description: short, detail: subject, name });
    }
  }

  const commits = await git(root, ['log', '-n', '20', '--format=%h%x09%s']).catch(() => '');
  items.push({ label: 'Recent commits', kind: vscode.QuickPickItemKind.Separator });
  for (const line of commits.split('\n').filter(Boolean)) {
    const [short, subject] = line.split('\t');
    if (short) {
      items.push({ label: short, description: subject, name: short });
    }
  }

  const choice = await vscode.window.showQuickPick(items, {
    title: 'Compare the map with …',
    placeHolder: 'The dependencies of that revision are compared with the map that is open',
    matchOnDescription: true,
  });
  if (!choice) {
    return undefined;
  }

  let name = choice.name;
  if (name === undefined) {
    name = (await vscode.window.showInputBox({ prompt: 'Commit, branch or tag (for example main, v0.4.0, HEAD~5)' }))?.trim();
    if (!name) {
      return undefined;
    }
  }

  const commit = await resolveCommit(root, name);
  if (!commit) {
    throw new AnalyzerError(`"${name}" is not a commit, branch or tag of this repository.`);
  }

  return { label: name, commit };
}

function runDotnet(dotnetPath: string, args: string[], output: vscode.OutputChannel, token?: vscode.CancellationToken): Promise<void> {
  return new Promise((resolve, reject) => {
    output.appendLine(`> ${dotnetPath} ${args.join(' ')}`);
    const child = cp.spawn(dotnetPath, args, { windowsHide: true });
    token?.onCancellationRequested(() => child.kill());
    child.stdout.on('data', (chunk: Buffer) => output.append(chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => output.append(chunk.toString('utf8')));
    child.on('error', (error) => reject(new AnalyzerError(`Could not start "${dotnetPath}": ${error.message}`)));
    child.on('close', (code) => (code === 0 ? resolve() : reject(new AnalyzerError(`"dotnet ${args[0]}" failed (exit code ${code}).`))));
  });
}

export interface CompareOptions {
  /** The solution or project file of the open map. */
  target: string;
  revision: Revision;
  analyzerDll: string;
  dotnetPath: string;
  output: vscode.OutputChannel;
  token?: vscode.CancellationToken;
  progress?: (message: string) => void;
  readXaml?: boolean;
}

/**
 * Analyzes the solution as it was in a revision. The revision is checked out into a temporary worktree
 * (the working directory of the user is not touched), the packages are restored there, and the worktree
 * is removed afterwards.
 */
export async function analyzeRevision(options: CompareOptions): Promise<AtlasGraph> {
  const { target, revision, output, token } = options;
  const root = await repositoryRoot(path.dirname(target));
  const relative = path.relative(root, target);
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-baseline-'));

  try {
    options.progress?.(`checking out ${revision.label}`);
    await git(root, ['worktree', 'add', '--detach', '--force', worktree, revision.commit]);

    const checkedOut = path.join(worktree, relative);
    if (!fs.existsSync(checkedOut)) {
      throw new AnalyzerError(`${relative} does not exist in ${revision.label}.`);
    }

    options.progress?.('restoring packages');
    await runDotnet(options.dotnetPath, ['restore', checkedOut], output, token);

    options.progress?.('analyzing');
    return await runAnalyzer({
      target: checkedOut,
      analyzerDll: options.analyzerDll,
      dotnetPath: options.dotnetPath,
      output,
      token,
      readXaml: options.readXaml,
    });
  } finally {
    await git(root, ['worktree', 'remove', '--force', worktree]).catch(() => {
      fs.rmSync(worktree, { recursive: true, force: true });
      return git(root, ['worktree', 'prune']).catch(() => '');
    });
  }
}
