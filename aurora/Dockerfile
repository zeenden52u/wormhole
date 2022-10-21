FROM ghcr.io/wormhole-foundation/aurora:2.7.0.5@sha256:a422f7312bf0e813e26a752bab27a5e627fc1214ba21cdb4a192dddab2fdf39d as aurora-node

WORKDIR /tmp

COPY scripts/package.json .
COPY scripts/package-lock.json .
COPY scripts/tiltnet.yaml .
RUN npm ci

COPY scripts/runner.sh .
COPY scripts/reset.ts .
COPY scripts/indexer.sh .
