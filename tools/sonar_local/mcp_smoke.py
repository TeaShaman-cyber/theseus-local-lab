#!/usr/bin/env python3
"""Protocol and persistence smoke test for the local Sonar MCP server."""

from __future__ import annotations

import asyncio
import argparse
import json
import sys
import time
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


SERVER = Path(__file__).with_name("sonar_mcp.py")
LAUNCHER = Path(__file__).with_name("launch_mcp_wsl.mjs")


def windows_path(path: Path) -> str:
    value = str(path.resolve())
    if value.startswith("/mnt/") and len(value) > 6:
        tail = value[7:].replace("/", "\\")
        return f"{value[5].upper()}:\\{tail}"
    return value


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


async def smoke(use_windows_launcher: bool) -> None:
    params = (
        StdioServerParameters(command="node.exe", args=[windows_path(LAUNCHER)])
        if use_windows_launcher
        else StdioServerParameters(command=sys.executable, args=[str(SERVER)])
    )
    started = time.perf_counter()
    async with stdio_client(params) as streams:
        async with ClientSession(*streams) as session:
            await session.initialize()
            tools = await session.list_tools()
            names = {tool.name for tool in tools.tools}
            expected = {"sonar_status", "sonar_refresh", "sonar_preflight"}
            if names != expected:
                raise RuntimeError(f"unexpected tools: {sorted(names)}")

            status_started = time.perf_counter()
            status_result = await session.call_tool("sonar_status")
            status_ms = round((time.perf_counter() - status_started) * 1000, 2)
            status = structured(status_result)
            if getattr(status_result, "isError", False):
                raise RuntimeError(f"sonar_status failed: {status_result}")

            first_started = time.perf_counter()
            first_result = await session.call_tool(
                "sonar_preflight",
                {
                    "query": "memory continuity after compact and model switch",
                    "refresh_if_stale": False,
                },
            )
            first_ms = round((time.perf_counter() - first_started) * 1000, 2)
            first = structured(first_result)
            if getattr(first_result, "isError", False):
                raise RuntimeError(f"first sonar_preflight failed: {first_result}")

            second_started = time.perf_counter()
            second_result = await session.call_tool(
                "sonar_preflight",
                {
                    "query": "which authority should verify Docker runtime state",
                    "refresh_if_stale": False,
                },
            )
            second_ms = round((time.perf_counter() - second_started) * 1000, 2)
            second = structured(second_result)
            if getattr(second_result, "isError", False):
                raise RuntimeError(f"second sonar_preflight failed: {second_result}")

    print(
        json.dumps(
            {
                "status": "PASS",
                "route": "windows_node_to_wsl" if use_windows_launcher else "direct_wsl",
                "tools": sorted(names),
                "documents": status["counts"]["documents"],
                "first_domains": first["domains"],
                "second_domains": second["domains"],
                "timing_ms": {
                    "session_total": round((time.perf_counter() - started) * 1000, 2),
                    "status": status_ms,
                    "first_preflight": first_ms,
                    "second_preflight_same_process": second_ms,
                },
            },
            ensure_ascii=True,
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--windows-launcher", action="store_true")
    args = parser.parse_args()
    asyncio.run(smoke(args.windows_launcher))
