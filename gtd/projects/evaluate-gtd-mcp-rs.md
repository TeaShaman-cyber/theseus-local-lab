# Проверить пригодность gtd-mcp-rs

## Desired outcome

Понять, подходит ли `gtd-mcp-rs` как минимальное локальное GTD-ядро для нашей работы в Codex.

## Definition of done

- сервер запускается в нашей Windows-среде;
- Codex может выполнить MCP `initialize`;
- работает цикл `capture → list → next_action → done`;
- данные хранятся в отдельном локальном `gtd.toml`;
- найденные ограничения записаны отдельно;
- принято решение `adopt`, `adapt` или `reject`.

## Current next action

Проверить наличие Rust/Cargo и подготовить изолированный локальный каталог для пробного запуска.

## Scope boundary

На пилоте не подключать Basic Memory Cloud, ButlerBrain, Notion, календарь и автоматический Git push.
