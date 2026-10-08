#!/bin/sh
# Installs signalk-server and any extra package tarballs (workspace packages,
# locally built dependencies) from the current directory.
#
# Servers that locate their bundled packages through module resolution
# (dist/bundled-packages.js) are installed with pnpm. Older servers only find
# them inside their own node_modules, so they keep the npm nested install and
# the relocation of the @signalk packages and KIP.
set -e

server_tarball=$(ls signalk-server-[0-9]*.tgz | head -n 1)
echo "Found Server: $server_tarball"

if tar -tzf "$server_tarball" | grep -q '^package/dist/bundled-packages.js$'; then
  # pnpm runs dependency install scripts only for approved packages.
  # @canboat/canboatjs builds its native SocketCAN addon from an "install"
  # script and ships no prebuilt binaries. Other dependencies' scripts are not
  # needed at runtime and are skipped instead of failing the install.
  # The overrides make the server's dependencies on the extra packages resolve
  # to these tarballs instead of the registry.
  printf '%s\n' \
    'strictDepBuilds: false' \
    'allowBuilds:' \
    "  '@canboat/canboatjs': true" \
    "  '@serialport/bindings-cpp': true" \
    'minimumReleaseAgeExclude:' \
    "  - '@signalk/*'" \
    "  - '@canboat/*'" \
    'overrides:' > pnpm-workspace.yaml
  for tgz in *.tgz; do
    name=$(tar -xOzf "$tgz" package/package.json | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).name')
    printf "  '%s': file:./%s\n" "$name" "$tgz" >> pnpm-workspace.yaml
  done
  printf '{"name":"signalk","private":true}\n' > package.json
  pnpm add ./*.tgz
  # node_modules holds hard links to the store, so the store can go
  rm -rf "$(pnpm store path)" "$HOME/.cache/pnpm"
  # canboatjs swallows a failed addon build, so assert it here: without the
  # addon the server starts but has no CAN interface
  if [ -z "$(find node_modules -path '*/@canboat/canboatjs/build/Release/canSocket.node' -print -quit)" ]; then
    echo "canSocket.node missing: the canboatjs native CAN addon did not build" >&2
    exit 1
  fi
else
  extras=$(ls *.tgz | grep -v "^$server_tarball\$" || true)
  echo "Found Extras: $extras"
  npm init -y
  if [ -n "$extras" ]; then
    npm install $extras
    npm install "$server_tarball" --install-strategy=nested
  else
    # Older servers use packages they do not declare, which only resolve
    # when hoisted
    npm install "$server_tarball"
  fi
  if [ -d node_modules/@signalk ]; then
    dest="node_modules/signalk-server/node_modules"
    mkdir -p "$dest/@signalk"
    cp -rf node_modules/@signalk/* "$dest/@signalk/"
    mkdir -p "$dest/@mxtommy"
    if [ -d node_modules/@mxtommy/kip ]; then cp -rf node_modules/@mxtommy/kip "$dest/@mxtommy/"; fi
  fi
  npm cache clean --force
fi

rm *.tgz
