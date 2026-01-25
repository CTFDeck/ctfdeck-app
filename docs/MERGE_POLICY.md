# Merge process

## General principles

The merge process is designed to ensure code quality, architectural consistency, and full traceability of changes throughout the development lifecycle. Each step encourages code review, knowledge sharing, and stability of the target branches.

## Issue to feature Pull Request

When an issue is completed, a **pull request** is opened from the issue branch to the corresponding **feature** branch.

- The pull request must be **clearly described**: goal, functional scope, and any potential technical impact.
- Commits should be **clean and consistent** (no temporary or unrelated commits).
- Existing tests must pass and be extended when necessary.

## Review and approval

- The pull request must be **reviewed and approved by at least two team members**.
- The review focuses in particular on:
    - functional compliance with the issue,
    - code quality and readability,
    - adherence to project conventions and architecture,
    - potential impact on other parts of the codebase.
- In case of **rejection or change requests**, fixes must be implemented by the concerned team member.
- Once changes are applied, the pull request must be **submitted again for review and approval**.

## Feature completion

Once all issues related to a feature are integrated and validated:

- The **feature branch** is considered complete and stable.
- The feature branch is **manually merged** into the branch corresponding to the current sprint (**POC**, **MVP**, or **DELIVERY**).
- This merge marks the feature as ready for the next phase (global testing, product validation, or delivery).

## Process objectives

- Minimize regressions and production issues.
- Continuously improve overall code quality.
- Maintain a clear view of feature and sprint progress.

