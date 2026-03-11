# signalk-server-dockers

Dev-Ops test repo for SK build pipelines development.

## Package manager policy

CI workflows and Docker build logic use **pnpm** as the Node package manager.

- GitHub Actions jobs should install pnpm via `pnpm/action-setup` and use `actions/setup-node` cache mode `pnpm`.
- Docker images should activate pnpm with Corepack (`corepack enable` + `corepack prepare pnpm@10.6.3 --activate`).
- For compatibility with scripts expecting a flattened `node_modules` layout, use `node-linker=hoisted` where needed.

