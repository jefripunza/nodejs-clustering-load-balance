#!/bin/bash

#-> execute : bash test.sh 2e26b323df6338a276cdf7a84b6b029ccfacb6ab93e06087f9e1267f1746686f http://localhost:3000 1000

# Cek jumlah argumen
if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <container_name> <host> <loop_count>"
    exit 1
fi

# Assign argumen ke variabel
CONTAINER_NAME="$1"
HOST="$2"
LOOP_COUNT="$3"

# Restart container
echo "Restarting container..."
if ! docker restart "$CONTAINER_NAME"; then
    echo "Error: Failed to restart container $CONTAINER_NAME"
    exit 1
fi
echo "Container restarted successfully!"

# Tunggu 10 detik untuk container benar-benar siap
echo "waiting container started..."
sleep 10
echo "container started!"

# Mendapatkan penggunaan memori sebelum melakukan performance test
echo "get start stats container..."
start_memory_output=$(docker stats --no-stream "$CONTAINER_NAME" --format "{{.MemUsage}}")
IFS='/' read -r start_used_memory _ <<< "$start_memory_output"
start_used_memory=$(echo "$start_used_memory" | tr -d ' ')

timestamp_start=$(date +"%Y-%m-%d %H:%M:%S")

# Melakukan request sebanyak LOOP_COUNT ke HOST secara serentak
echo "process..."
# seq $LOOP_COUNT | xargs -n1 -P10 -I {} curl -sS -o /dev/null -w "%{http_code}\n" "$HOST"
for ((i=1; i<=$LOOP_COUNT; i++)); do
    curl -sS -o /dev/null -w "%{http_code}\n" "$HOST"
done
echo "process done!"

# Mendapatkan penggunaan memori setelah melakukan performance test
echo "get end stats container..."
end_memory_output=$(docker stats --no-stream "$CONTAINER_NAME" --format "{{.MemUsage}}")
IFS='/' read -r end_used_memory _ <<< "$end_memory_output"
end_used_memory=$(echo "$end_used_memory" | tr -d ' ')

# Format tanggal dan waktu saat ini
timestamp_end=$(date +"%Y-%m-%d %H:%M:%S")

# Membuat log hasil performance test
log_message="$timestamp_start|$timestamp_end|$LOOP_COUNT|$start_used_memory|$end_used_memory"

# Menyimpan log ke dalam test-result.txt dengan mode append
echo "$log_message" >> test-result.txt

echo "finish!"