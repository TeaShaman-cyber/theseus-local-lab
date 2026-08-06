FROM rust:1-bookworm AS build

ARG GTD_MCP_REF=main
WORKDIR /src

RUN apt-get update \
    && apt-get install --yes --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch "${GTD_MCP_REF}" https://github.com/ekicyou/gtd-mcp-rs.git .

RUN cargo fetch --locked

RUN cargo build --release --locked

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /src/target/release/gtd-mcp /usr/local/bin/gtd-mcp

ENTRYPOINT ["gtd-mcp"]
