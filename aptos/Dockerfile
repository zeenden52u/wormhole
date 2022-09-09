FROM ghcr.io/wormhole-foundation/aptos:0.3.3n@sha256:1a5b790a9187dbbd96268e555d0fb1c7ea20bb3b29af1fda7f3c96f66729181c as aptos

# Support additional root CAs
COPY cert.pem* /certs/
RUN if [ -e /certs/cert.pem ]; then cp /certs/cert.pem /etc/ssl/certs/ca-certificates.crt; fi

WORKDIR /tmp
COPY README.md aptos/README.md

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
