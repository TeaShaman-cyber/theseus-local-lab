#!/usr/bin/env python3
"""Bounded MCP Streamable HTTP smoke test for the Docker Sonar route."""

from __future__ import annotations

import argparse
import asyncio
import json
import os

from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client


EXPECTED_TOOLS = {"sonar_status", "sonar_refresh", "sonar_preflight"}


def structured(result: object) -> dict:
    value = getattr(result, "structuredContent", None)
    if value is None:
        value = getattr(result, "structured_content", None)
    if isinstance(value, dict):
        return value
    for item in getattr(result, "content", []):
        text = getattr(item, "text", None)
        if text:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
    raise RuntimeError("MCP result did not contain a structured object")


async def smoke(url: str) -> dict:
    async with streamable_http_client(url) as streams:
        async with ClientSession(streams[0], streams[1]) as session:
            await session.initialize()
            tools = await session.list_tools()
            tool_names = {tool.name for tool in tools.tools}
            assert tool_names == EXPECTED_TOOLS, sorted(tool_names)

            status_result = await session.call_tool("sonar_status")
            status = structured(status_result)
            assert status["counts"]["documents"] > 0, status

            preflight_result = await session.call_tool(
                "sonar_preflight",
                {
                    "query": "memory continuity after compact and model switch",
                    "refresh_if_stale": False,
                },
            )
            preflight = structured(preflight_result)
            assert preflight["status"] == "OK", preflight

    return {
        "status": "PASS",
        "url": url,
        "tools": sorted(tool_names),
        "documents": status["counts"]["documents"],
        "preflight_status": preflight["status"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--url",
        default=os.getenv("THESEUS_SONAR_HTTP_URL", "http://127.0.0.1:8791/mcp"),
    )
    args = parser.parse_args()
    print(json.dumps(asyncio.run(smoke(args.url)), ensure_ascii=True))


if __name__ == "__main__":
    main()
