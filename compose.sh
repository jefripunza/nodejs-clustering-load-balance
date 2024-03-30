#!/bin/bash

docker-compose pull

if [ -f "docker-compose-local.yaml" ]; then
    docker-compose -f docker-compose-local.yaml up --force-recreate --build -d
else
    echo "File docker-compose-local.yaml not found."
fi

docker image prune -f
