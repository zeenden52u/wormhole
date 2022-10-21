# first build the image

DOCKER_BUILDKIT=1 docker build --progress plain -f Dockerfile.base -t aurora .

# tag the image with the appropriate version

docker tag aurora:latest ghcr.io/wormhole-foundation/aurora:2.7.0.5

# push to ghcr

docker push ghcr.io/wormhole-foundation/aurora:2.7.0.5

# 2.7.0: digest: sha256:8c5edbc97b6260c0d70792c539c98ae71d661d9f980461621cc5f7e5cf5d381f size: 4122
