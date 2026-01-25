# Update branche

## No direct branch merge

Direct `git merge` between branches is not allowed for branch updates.

## Git rebase

Branch synchronization must be done using **`git rebase`**.

## Why using rebase

Rebasing is used to keep a **clean, linear, and readable Git history**.

- It avoids unnecessary merge commits that add noise to the history.
- It makes the commit timeline easier to understand and review.
- It helps clearly identify when and why each change was introduced.
- It reduces conflicts when integrating branches later in the workflow.
- It simplifies debugging, rollback, and code archaeology (`git bisect`, history analysis).

## Usage guidelines

- Rebase your branch regularly on its target branch to stay up to date.
- Resolve conflicts carefully during the rebase to ensure code consistency.
- Never rebase a branch that is already shared or used by others without coordination.

## Objective

The goal of this process is to maintain a **clear, predictable, and maintainable version control history** while reducing long-term integration issues.