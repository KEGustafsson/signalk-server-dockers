#!/usr/bin/env sh

# Detect container runtime
if [ -z "$CONTAINER_RUNTIME" ]; then
    if [ -f /.dockerenv ]; then
        export CONTAINER_RUNTIME="docker"
    elif [ -f /run/.containerenv ]; then
        export CONTAINER_RUNTIME="podman"
    elif [ -n "$KUBERNETES_SERVICE_HOST" ]; then
        export CONTAINER_RUNTIME="kubernetes"
    else
        if [ -f /proc/1/cgroup ]; then
            if grep -q '/docker' /proc/1/cgroup 2>/dev/null; then
                export CONTAINER_RUNTIME="docker"
            elif grep -q '/libpod' /proc/1/cgroup 2>/dev/null; then
                export CONTAINER_RUNTIME="podman"
            elif grep -q '/kubepods' /proc/1/cgroup 2>/dev/null; then
                export CONTAINER_RUNTIME="kubernetes"
            elif grep -q '/lxc' /proc/1/cgroup 2>/dev/null; then
                export CONTAINER_RUNTIME="lxc"
            elif grep -q '/containerd' /proc/1/cgroup 2>/dev/null; then
                export CONTAINER_RUNTIME="containerd"
            fi
        fi
    fi
fi

export IS_IN_DOCKER=true

# Check if host D-Bus socket is mounted
if [ -S /run/dbus/system_bus_socket ] && dbus-send --system --dest=org.freedesktop.DBus --print-reply /org/freedesktop/DBus org.freedesktop.DBus.ListNames >/dev/null 2>&1; then
    echo "Using host D-Bus (socket mounted from host)"
else
    echo "Starting container D-Bus and Avahi services"
    # Use sudo if running as 'node' user, as these require root
    sudo service dbus restart
    sudo /usr/sbin/avahi-daemon -k 2>/dev/null
    sudo /usr/sbin/avahi-daemon --no-drop-root &
    sudo service bluetooth restart
fi

# --- NSOLID & PM2 OPTIMIZATION ---
# Explicitly tell PM2 to use the N|Solid (node) binary
export PM2_NODE_BINARY=$(command -v node)

# We use pm2-runtime (the successor to pm2-docker) for better container signal handling.
# The '--' separates PM2 arguments from the Signal K arguments.
exec pm2-runtime start /home/node/signalk/node_modules/signalk-server/bin/signalk-server \
    --name "signalk-server" \
    --node-args="--trace-deprecation" \
    -- --securityenabled
