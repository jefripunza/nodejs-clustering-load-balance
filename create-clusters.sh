#!/bin/bash

FILE_TARGET="nginx.conf"

# Mendapatkan nilai WORKER dari docker-compose.yaml
WORKER=$(grep 'WORKER=' docker-compose.yaml | awk -F= '{print $2}')
if [ -z "$WORKER" ]; then
    WORKER=4
fi

# Membuat file nginx.conf
{
    echo "worker_processes  1;

events {
    worker_connections  1024;
}

http {
    upstream servers {
        least_conn;"  # Menambahkan least_conn di sini

    # Menambahkan setiap server clusters ke dalam upstream
    for ((i=1; i<=$WORKER; i++))
    do
        # Memeriksa jumlah digit pada nomor port
        if [[ $i -lt 10 ]]; then
            PORT="300$i"
        elif [[ $i -lt 100 ]]; then
            PORT="30$i"
        else
            PORT="3$i"
        fi
        echo "        server clusters:$PORT;" 
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

            # Tambahkan baris berikut untuk mengatur pengaturan reconnect
            proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
        }
    }
}" 
} > $FILE_TARGET

echo "File nginx.conf telah berhasil dibuat dengan $WORKER server upstream."
