# Branches

### Main branches:

The branch tree follows a clear hierarchy to separate environments, features, and issues.

There are main branches, which are listed below:

- **stage**
- **poc**
- mvp

These branches are protected: no direct commits, only via **Pull Requests** from child branches.

### Feature branches:

**Feature** branches descend from one of the main branches. They will be created manually with the following naming convention:

```bash
<scope>/<feature-name>
```

For example:

```bash
poc/add-login-page
```

Each feature branch represents a major feature of the project and is itself subdivided into several tasks (issues).

### Issue branches:

## Branch naming convention:

**Issue** branches descend from feature branches. They correspond to an issue related to the feature.

They will follow the following naming convention:

```bash
CTFD-<number>-short-description
```

For example:

```bash
CTFD-121-fix-session-timeout
```

### Best practices:

- Always create the branch from the corresponding **feature** or **main branch**.
- Always follow naming conventions.
- Delete branches once the PR has been validated and the merge completed.
- All PRs must be linked to an issue.
