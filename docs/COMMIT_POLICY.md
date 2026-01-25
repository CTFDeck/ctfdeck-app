# Commit

## Commit standard:

### General format:

Each commit message must comply with the [**Angular Commit Convention**](https://www.conventionalcommits.org/en/v1.0.0-beta.4/) adapted to the project:

```jsx
feat(CTFD-42): add scan report management
fix(CTFD-17): fix error 500 when launching a scan
chore(CTFD-3): update backend dependencies

```

### Rules:

- The message should **never** start with a **capital letter**
- The message should **never** end with a **period**
- The message must always be **brief** and **descriptive**
- Always include the **branch prefix** corresponding to **the issue** (**‘CTFD-<issue number>’**)

### Allowed types:

- **feat**: New feature
- **fix**: Bug fix
- **chore**: Miscellaneous tasks (build, dependencies, etc.)
- **refactor**: Refactoring without adding functionality
- **docs**: Addition/modification of documentation
- **style**: Style modification (indentation, formatting, etc.)
- **test**: Addition/modification of tests
- **perf**: Optimization/performance improvement
- **ci**: Changes related to CI

### Best practices:

- One commit = one consistent change
- Always check that the message accurately represents the changes made in the commit
- If several changes are made, divide them into several commits

