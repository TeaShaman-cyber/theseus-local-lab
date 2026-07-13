FROM node:24-alpine

RUN apk add --no-cache docker-cli git

WORKDIR /workspace
RUN git config --system --add safe.directory /workspace

ENV PORT=5180
ENV THESEUS_HOST=host.docker.internal
ENV DOCKER_HOST=tcp://host.docker.internal:2375
ENV THESEUS_CLOUD_MIRROR_DIR=/cloud-backups

CMD ["node", "tools/workshop_dashboard/server.mjs"]
