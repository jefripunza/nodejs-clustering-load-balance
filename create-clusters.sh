#!/bin/bash

FILE_TARGET="nginx.conf"

# Mendapatkan nilai WORKER dari docker-compose.yaml
WORKER=$(grep 'WORKER=' docker-compose.yaml | awk -F= '{print $2}')

# Membuat file nginx.conf
{
    echo "worker_processes  1;

events {
    worker_connections  1024;
}

http {
    upstream servers {"

    # Menambahkan setiap server nodejs_clusters ke dalam upstream
    for ((i=1; i<=$WORKER; i++))
    do
        echo "        server nodejs_clusters:300$i;" 
    done

    # Menutup blok upstream dan menambahkan server blok
    echo "    }

    server {
        listen 80;

        location / {
            proxy_pass http://servers;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_cache_bypass \$http_upgrade;
        }
    }
}" 
} > $FILE_TARGET

echo "File nginx.conf telah berhasil dibuat dengan $WORKER server upstream."
