# signalk-server-dockers

Dev-Ops test repo for SK build pipelines development.

## Running the images

The container runs the server directly, not under pm2, so let the container
runtime restart it, e.g. `docker run --restart unless-stopped ...`. `tini` is
PID 1 and forwards the SIGTERM of `docker stop` to the server, which shuts
down cleanly instead of being killed after the stop timeout.
