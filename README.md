# signalk-server-dockers

Dev-Ops test repo for SK build pipelines development.

## Running the images

The container runs the server directly, not under pm2, so let the container
runtime restart it, e.g. `docker run --restart unless-stopped ...`. `tini` is
PID 1 and forwards the SIGTERM of `docker stop` to the server, which shuts
down cleanly instead of being killed after the stop timeout.

## Installing plugins from a shell

Recent servers come with `signalk-pnpm`, which installs plugins and webapps
into the config directory the way the App Store does, with the same pnpm,
settings and store (`/home/node/.signalk/.pnpm-store`). Run it in a container
whose `/home/node/.signalk` is a persistent volume, then restart the
container:

```sh
docker exec my-container signalk-pnpm add @signalk/some-plugin
docker restart my-container
```

or bake plugins into a derived image:

```Dockerfile
FROM ghcr.io/kegustafsson/signalk-server:latest
RUN signalk-pnpm add @signalk/some-plugin
```

The server prunes the pnpm store after every install and leaves it out of its
settings backups; leave it out of your own backups of the volume as well,
since pnpm refills it from the registry. `signalk-pnpm --help` describes the
command.
