#!/bin/bash

bash create-clusters.sh

docker-compose pull

# if [ -f "docker-compose-local.yaml" ]; then
#     docker-compose -f docker-compose-local.yaml up --force-recreate --build -d
# else
#     echo "File docker-compose-local.yaml not found."
# fi

docker-compose -f docker-compose.yaml up --force-recreate --build -d

docker image prune -f
