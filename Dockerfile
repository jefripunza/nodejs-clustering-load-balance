FROM node:18-alpine as builder
WORKDIR /builder

COPY . .

# 🌊 Install Dependencies
RUN yarn
CMD ["yarn", "start"]

# # 💯 Configuration
# # RUN sed -i 's#localhost#host.docker.internal#g' .env
# RUN sed -i 's#win-x64#alpine-x64#g' package.json
# RUN sed -i 's#./build/run.exe#/builder/build/run.bin#g' package.json

# # 🔨 Build App
# RUN yarn compile

# # -----------------------------------------------------------------------------------------
# # -----------------------------------------------------------------------------------------

# # 🚀 Finishing !!
# FROM alpine:latest as runner
# WORKDIR /app

# # Add the community repository to get ffmpeg
# RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories

# # Install ffmpeg along with the other tools
# RUN apk add --no-cache openssl curl nano libstdc++ libgcc

# COPY --from=builder /builder/build/run.bin  /app/
# # COPY --from=builder /builder/.env           /app/

# RUN chmod +x /app/run.bin

# CMD ["/app/run.bin"]
