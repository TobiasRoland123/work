This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# Getting Started

First, run the development server:

`pnpm dev`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

# Branch strategy

We use main as our production branch, but development will happen by merging into the `develop` branch.

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

`pnpm run test:backend`
