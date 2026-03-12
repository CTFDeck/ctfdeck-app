# Commit

## Commit standard:

### General format:

Each commit message must comply with the **Angular Commit Convention** adapted to the project:

```
feat(CTFD-42): add scan report management
fix(CTFD-17): fix error 500 when launching a scan
chore(CTFD-3): update backend dependencies
```

### Rules:

- The message should **never** start with a **capital letter**
- The message should **never** end with a **period**
- The message must always be **brief** and **descriptive**
- Always include the **branch prefix** corresponding to **the issue** (**CTFD-<issue number>**)

### Allowed types:

- **feat**: new feature
- **fix**: bug fix
- **chore**: miscellaneous tasks (build, dependencies, etc.)
- **refactor**: refactoring without adding functionality
- **docs**: addition/modification of documentation
- **style**: style modification (indentation, formatting, etc.)
- **test**: addition/modification of tests
- **perf**: optimization/performance improvement
- **ci**: changes related to CI

### Best practices:

- One commit = one consistent change
- Always check that the message accurately represents the changes made in the commit
- If several changes are made, divide them into several commits
