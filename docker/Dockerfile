FROM ghcr.io/kegustafsson/signalk-server-base:latest AS base

USER node
RUN mkdir -p /home/node/.signalk/ /home/node/signalk/ \
  && npm config rm proxy \
  && npm config rm https-proxy \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 60000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set registry "https://registry.npmjs.org/" \
  && npm config set @backup:registry "https://registry.yarnpkg.com/" \
  && npm cache clean -f

WORKDIR /home/node/signalk

FROM base AS tarballs_installed
WORKDIR /home/node/signalk
COPY *.tgz .
USER root
RUN npm in -g signalk-server-*.tgz \
  && mv /usr/lib/node_modules/@signalk/* /usr/lib/node_modules/signalk-server/node_modules/@signalk/ \
  && cp *.tgz /usr/lib/node_modules/signalk-server/ \
  && ls -la /usr/lib/node_modules/signalk-server/*.tgz \
  && npm cache clean --force

FROM base AS production
USER root
RUN ln -s /usr/lib/node_modules/signalk-server/bin/signalk-server /usr/bin/signalk-server
COPY --from=tarballs_installed /usr/lib/node_modules /usr/lib/node_modules
USER node
COPY --chown=node docker/startup.sh /home/node/signalk/startup.sh
RUN chmod +x /home/node/signalk/startup.sh
EXPOSE 3000
ENV IS_IN_DOCKER true
ENV SKIP_ADMINUI_VERSION_CHECK true
WORKDIR /home/node/.signalk
ENTRYPOINT ["/home/node/signalk/startup.sh"]
