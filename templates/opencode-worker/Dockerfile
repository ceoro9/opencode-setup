FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH=/opt/opencode/node/bin:/opt/opencode/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends bash ca-certificates curl git jq ripgrep tini && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://nodejs.org/dist/v22.22.1/node-v22.22.1-linux-x64.tar.xz -o /tmp/node.tar.xz && mkdir -p /opt/opencode && tar -xJf /tmp/node.tar.xz -C /opt/opencode --strip-components=1 && rm /tmp/node.tar.xz
RUN /opt/opencode/node/bin/npm install --global --prefix /opt/opencode opencode-ai@1.18.11

WORKDIR /workspace

CMD opencode serve --hostname 0.0.0.0 --port 4096
