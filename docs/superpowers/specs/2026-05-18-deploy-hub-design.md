# Deploy Hub Design

**Date:** 2026-05-18

**Goal:** Create a shared local "deploy hub" that lets Codex deploy multiple projects by SSH first, then gradually standardize each server onto a reusable `deploy.sh` contract.

## 1. Problem

`bandsustain` already has an in-app deploy flow, but newly added projects do not. The operator wants to run the same "reflect remote GitHub changes on the server" workflow from Codex without building a custom deploy UI inside every project first.

The design should optimize for:

- fast onboarding of new projects
- low per-project code changes at the beginning
- a clear path from ad hoc SSH commands to a stable server-side deploy script
- reuse across multiple projects with different paths, branches, and process managers

## 2. Decision

We will use a separate shared local folder, tentatively named `deploy-hub`, as the control point for multi-project deployment.

The rollout has three phases:

1. Phase 1: Codex reads per-project config and performs deployment by SSHing into the server and executing the deploy steps directly.
2. Phase 2: Each project server gets a standardized `scripts/deploy.sh`, and Codex switches to calling that script remotely instead of issuing each step manually.
3. Phase 3: Individual projects may optionally add internal deploy UI or admin tools, but this is not required for the shared hub to work.

## 3. Recommended Folder Structure

The shared hub lives outside any one app repository.

Example root:

```text
C:\Users\pjuhe\OneDrive\Project\deploy-hub
```

Recommended structure:

```text
deploy-hub/
  README.md
  docs/
    deploy-standard.md
    project-onboarding.md
    ssh-setup.md
  projects/
    project-a.json
    project-b.json
  templates/
    deploy.config.example.json
    deploy.sh.example
```

Responsibilities:

- `README.md`: quick start for operating the hub
- `docs/deploy-standard.md`: the canonical deploy lifecycle and rules
- `docs/project-onboarding.md`: checklist for attaching a new project
- `docs/ssh-setup.md`: SSH key, host alias, and access assumptions
- `projects/*.json`: one file per project with only project-specific values
- `templates/deploy.config.example.json`: starter config for new projects
- `templates/deploy.sh.example`: server-side standard deploy script for phase 2

## 4. Project Config Contract

Each project should be described by a small config file. The config is the unit of reuse. Codex should not need to inspect every project manually once the config is trustworthy.

Minimum fields:

```json
{
  "name": "example-app",
  "local_repo_path": "C:\\Users\\pjuhe\\OneDrive\\Project\\example-app",
  "ssh_host": "example-prod",
  "ssh_user": "ec2-user",
  "server_app_dir": "/var/www/example-app",
  "branch": "main",
  "install_cmd": "pnpm install --frozen-lockfile",
  "build_cmd": "pnpm build",
  "restart_cmd": "pm2 restart example-app --update-env",
  "healthcheck_url": "http://127.0.0.1:3000/"
}
```

Optional fields:

- `package_manager`: for human readability or validation
- `pre_deploy_cmd`: one-off preparatory command before pull/build
- `post_deploy_cmd`: extra post-restart action
- `env_file_path`: when a project depends on a known server-side env file
- `healthcheck_expected_status`: defaults to `200`
- `deploy_script_path`: used in phase 2 when the project has a server-side deploy script

## 5. Phase 1 Workflow

Phase 1 is intentionally simple so new projects can be attached quickly.

Codex flow:

1. Read the target project's config from `deploy-hub/projects/<project>.json`.
2. Confirm the local repo exists and the expected branch or remote is present.
3. SSH into the server using the configured host and user.
4. Change directory to `server_app_dir`.
5. Run:
   - `git fetch`
   - `git pull --ff-only origin <branch>`
   - install command when lockfile or project policy requires it
   - build command
   - restart command
6. Run a health check against `healthcheck_url`.
7. Return a concise operator summary with success/failure and the failing step if any.

Rules:

- use fast-forward pull only
- do not auto-resolve merge conflicts
- fail immediately if build or restart fails
- do not hide raw server errors from the operator
- keep the command sequence explicit until the server-side script exists

## 6. Phase 2 Workflow

Once a project stabilizes, move the deploy logic onto the server.

Codex flow:

1. Read `deploy_script_path` from project config.
2. SSH into the server.
3. Execute a single remote command such as:

```bash
cd /var/www/example-app && ./scripts/deploy.sh
```

Server-side script responsibilities:

- enforce the correct deploy user
- perform `git pull --ff-only`
- run install/build/restart in the correct order
- optionally skip install when dependencies did not change
- emit readable logs
- exit non-zero on failure
- optionally run a local smoke or health check

This phase reduces repeated command construction in Codex and makes deployment behavior consistent regardless of who launches it.

## 7. Boundaries

What deploy hub owns:

- shared deployment conventions
- shared onboarding docs
- per-project config
- the initial Codex-side deployment entrypoint
- the standard template for a server-side `deploy.sh`

What deploy hub does not own:

- application feature code
- per-project admin UI
- secrets generation or long-term secrets storage
- CI/CD hosted elsewhere such as GitHub Actions

## 8. Safety Model

The initial deployment path depends on SSH access from the Codex environment. That means the following prerequisites must be true before a project is operational in the hub:

- the project exists locally on this machine
- the server is reachable by SSH from this machine
- the correct SSH key is already available to the current user
- the remote app directory is known
- the runtime restart command is known and tested

Operational safeguards:

- prefer SSH host aliases so commands stay short and auditable
- keep one explicit config per project
- never use `git reset --hard` in normal forward deploy flow
- require a successful build before restart
- require a successful health check before reporting success

## 9. Onboarding Checklist For A New Project

Before a new project can be deployed through Codex:

1. Clone the project locally onto this machine.
2. Verify the remote repository and primary branch.
3. Verify the remote server SSH host and user.
4. Verify the deployed app directory on the server.
5. Verify package manager and lockfile policy.
6. Verify build command.
7. Verify process restart command.
8. Verify health check URL.
9. Create the project config file in `deploy-hub/projects/`.
10. Run the first deployment in phase 1 mode.
11. After the workflow is stable, add server-side `scripts/deploy.sh`.

## 10. Recommended First Deliverables

The first implementation pass should produce:

1. the `deploy-hub` folder scaffold
2. the shared docs listed above
3. one example project config file template
4. one real project config file for the first non-`bandsustain` project
5. a documented Codex command procedure for running phase 1 deployments

Implementation should stop there before adding richer automation. The next step can then add a reusable server-side `deploy.sh` template.

## 11. Success Criteria

This design is successful when:

- a new project can be added mostly by filling a config file
- Codex can deploy that project without any custom in-app deploy UI
- the operator can tell exactly which step failed
- the same project can later migrate from SSH-direct mode to server-script mode without changing the top-level operating model
