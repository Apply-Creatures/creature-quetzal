FROM alpine:latest

RUN apk add --no-cache \
    ffmpeg \
    git \
    curl \
    bash \
    autoconf \
    automake \
    libtool \
    make \
    gcc \
    g++ \
    libc-dev \
    python3 \
    nodejs-current \
    npm 

# Checkout rnnoise repository and build
WORKDIR /app
RUN git clone https://github.com/xiph/rnnoise.git && \
    cd rnnoise && \
    ./autogen.sh && \
    ./configure && \
    make && \
    make install

RUN rm -rf /root/.npm /root/.node-gyp /usr/lib/python3.*/site-packages/npm /usr/lib/python3.*/site-packages/npm-* && \
    apk del autoconf automake libtool make gcc g++ libc-dev && \
    rm -rf /var/cache/apk/*

# Copy project files
COPY . /app/denoise

# Set working directory
WORKDIR /app/denoise

# Install npm dependencies and build the project
RUN npm install && npm run build:all

# Start the application
CMD ["npm", "run", "start"]
