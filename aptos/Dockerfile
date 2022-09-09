FROM ghcr.io/wormhole-foundation/aptos:0.3.3n@sha256:01d3a7cd8dd7e07429a3d3f43abd5d9928bf249edefb2e576a273d5c9b86bda4 as aptos

# Support additional root CAs
COPY cert.pem* /certs/
RUN if [ -e /certs/cert.pem ]; then cp /certs/cert.pem /etc/ssl/certs/ca-certificates.crt; fi

WORKDIR /tmp
COPY start_node.sh start_node.sh

FROM aptos AS tests

WORKDIR /tmp

COPY wormhole/ wormhole
COPY token_bridge/ token_bridge
COPY deployer/ deployer
COPY coin/ coin
COPY examples/ examples
COPY Makefile Makefile

RUN --mount=type=cache,target=/root/.move,id=move_cache \
    make test
