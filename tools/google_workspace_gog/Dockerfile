FROM alpine:3.24 AS fetch

ARG GOG_VERSION=0.38.1
ARG GOG_SHA256=6576828ed6852949ba424b967c3ff4268b3d9c90e201f90fe3d539fe3a151ebb

RUN apk add --no-cache ca-certificates wget tar \
    && wget -q -O /tmp/gog.tgz \
       "https://github.com/openclaw/gogcli/releases/download/v${GOG_VERSION}/gogcli_${GOG_VERSION}_linux_amd64.tar.gz" \
    && printf '%s  %s\n' "$GOG_SHA256" /tmp/gog.tgz | sha256sum -c - \
    && tar -xzf /tmp/gog.tgz -C /tmp \
    && test -x /tmp/gog

FROM alpine:3.24

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S gog \
    && adduser -S -G gog -h /home/gog gog \
    && mkdir -p /home/gog/.config/gogcli \
    && chown -R gog:gog /home/gog

COPY --from=fetch /tmp/gog /usr/local/bin/gog
COPY entrypoint.sh /usr/local/bin/theseus-gog-entrypoint
RUN chmod 0555 /usr/local/bin/theseus-gog-entrypoint

ENV HOME=/home/gog
ENV GOG_HOME=/home/gog/.config/gogcli
WORKDIR /home/gog
USER gog

ENTRYPOINT ["/usr/local/bin/theseus-gog-entrypoint"]
CMD ["--help"]
