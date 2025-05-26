## Bachelor docs
https://docs.google.com/document/d/1-Pcko4L51awdj_o72inqvJ-Nlt44I2JKbsJnGuULhcE/edit?usp=sharing

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# Getting Started

First, run the development server:

`pnpm dev`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

# Branch strategy

We use main as our production branch, but development will happen by merging into the `develop` branch.

## Linking to AzureDevOps tasks

We are using AzureDevOps for managing our tasks and therefore we need to link our branches, commits and pr's to the correct task when working on a feature or bug.

### Task linking overview

read more here: [Link GitHub commits, pull requests, branches, and issues to work items in Azure Boards](http://learn.microsoft.com/en-us/azure/devops/boards/github/link-to-from-github?view=azure-devops)
To link a task to a commit, include the task id in the commit message using the format `AB#{ID}`.
If linking a Pr or Issue, then add `AB#{ID}` to either the title or description.

| Commit or pull request message                         | Action                                                                                                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed AB#123                                           | Links and transitions the work item to the Resolved workflow state category or, if none is defined, then the Completed workflow state category.                                                      |
| Closed AB#123                                          | Links and transitions the work item to the Closed workflow state. If none is defined, no transitions are made.                                                                                       |
| Adds a new feature, fixes AB#123.                      | Links and transitions the work item to the Resolved workflow state category or, if none is defined, then the Completed workflow state category.                                                      |
| Fixes AB#123, AB#124, and AB#126                       | Links to Azure Boards work items 123, 124, and 126. Transitions only the first item, 123 to the Resolved workflow state category or, if none is defined, then the Completed workflow state category. |
| Fixes AB#123, Fixes AB#124, Fixes AB#125               | Links to Azure Boards work items 123, 124, and 126. Transitions all items to either the Resolved workflow state category or, if none is defined, then the Completed workflow state category.         |
| Fixing multiple bugs: issue #123 and user story AB#234 | Links to GitHub issue 123 and Azure Boards work item 234. No transitions are made.                                                                                                                   |

## Branch naming

When creating new branches they should always be solving a task or bug, which is listed in Azure DevOps. When crating branches they should include the id of the task, so that it's easy to see what task this branch is solving:

### Feature branch example:

`feat/[task-id]-[actual-branch-name]`

### Bug Fixing Branch example:

`fix/[task-id]-[actual-branch-name]`

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# PostGreSQL command overview

## General command to start and run db

`pnpm run db:start`
Visit drizzle dashboard at [https://local.drizzle.studio/](https://local.drizzle.studio/)

### Start PostgreSQL database container

`pnpm run db:up`

### Stop PostgreSQL database container

`pnpm run db:down`

### Generate migration files based on schema changes

`pnpm run db:generate`

### Push schema changes directly to the database

`pnpm run db:push`

### Open Drizzle Studio web UI to browse and manage data

`pnpm run db:studio`

### Seed database with sample data

`pnpm run db:seed`

## Testing with ViTest

# ViTest Commands to our setup

Since our project is a mono repo, and we want to isolate some testing groups, we have decided split it up into different test groups.

### Run all tests

`pnpm test` (This will potentially fail automatically since it's running storybook tests without a storybook instance running)

### Run all storybook tests

`pnpm run test-storybook`

### Run all backend tests

## `pnpm run test:backend`

# Testing strategy for components

In our project, we use Storybook as a central tool for testing and developing UI components in isolation. Our testing approach combines visual testing and component testing to ensure both design consistency and functionality.

## Visual tests

We use Chromatic for automated visual regression testing. This allows us to catch any unintended UI changes by comparing component snapshots across versions, ensuring that visual changes are intentional and reviewed.
Everything visual should be handled by the visual test.

## Components test

Alongside visual testing, we perform component-level tests to verify that:

- The correct props are passed and handled by the component.
- The expected elements and content are rendered properly.
- The core functionality and behavior of each component work as intended.

This combination of visual and functional testing helps us maintain a high level of quality, confidence in changes, and a smooth developer experience.

# Developing on CI/CD yml files

When working on this projects CI/CD pipeline, it's a good idea to test the pipeline locally before pushing it up to the cloud-runners in GitHub.
To test it locally, we recommend using Act.
`brew install act`
To use act, you simply navigate to the root of the project directory you want to run a pipeline test on and run the command:
`act <job_name>`
where <job_name> can be "push", "pull_request" etc.
This will run the pipeline locally, and you can see the output in your terminal.
