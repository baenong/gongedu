#!/bin/sh
set -e

# docker-compose가 bind-mount하는 data/uploads/backup/logs는 호스트에서
# 처음 생성될 때 root 소유가 되는 경우가 많다. 컨테이너는 root로 시작해
# 이 디렉터리들의 소유권을 node 유저로 맞춘 뒤 권한을 낮춰 실행한다.
for dir in /app/data /app/uploads /app/backup /logs; do
  mkdir -p "$dir"
  chown -R node:node "$dir"
done

exec su-exec node "$@"
