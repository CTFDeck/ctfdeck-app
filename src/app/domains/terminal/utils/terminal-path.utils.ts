export function looksLikeDirectoryChange(command: string): boolean {
  const trimmed = command.trim();

  if (!trimmed) {
    return false;
  }

  const parts = trimmed.split(/\s+/);
  const base = (parts[0] || '').toLowerCase();

  return base === 'cd' || base === 'pushd' || base === 'popd';
}

export function looksLikeDirectoryListing(command: string): boolean {
  const trimmed = command.trim();

  if (!trimmed) {
    return false;
  }

  const parts = trimmed.split(/\s+/);
  const base = (parts[0] || '').toLowerCase();

  return base === 'ls' || base === 'dir';
}

export function getHomePathFromPath(path: string): string {
  const match = path.match(/^(\/[a-z]\/Users\/[^/]+|\/home\/[^/]+|C:\/Users\/[^/]+)/i);

  return match ? match[1] : '';
}

export function getHomePathFromWorkingDirectory(workingDirectory: string): string {
  const match = workingDirectory.match(
    /^(\/[a-z]\/Users\/[^/]+|\/home\/[^/]+|C:\\Users\\[^\\/]+)/i,
  );

  return match ? match[1].replace(/\\/g, '/') : '';
}

export function formatPromptFromPath(workingDirectory: string): string {
  const pwd = (workingDirectory || '').trim();

  if (!pwd) {
    return '$';
  }

  const displayPath = pwd.replace(/\\/g, '/');
  const home = getHomePathFromPath(displayPath);

  return home && displayPath.startsWith(home)
    ? `~${displayPath.slice(home.length)} $`
    : `${displayPath} $`;
}

export function formatPromptFromWorkingDirectory(workingDirectory: string): string {
  const pwd = (workingDirectory || '').trim();

  if (!pwd) {
    return '$';
  }

  const displayPath = pwd.replace(/\\/g, '/');
  const home = getHomePathFromWorkingDirectory(workingDirectory);

  return home && displayPath.startsWith(home)
    ? `~${displayPath.slice(home.length)} $`
    : `${displayPath} $`;
}
