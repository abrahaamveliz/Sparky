"""Tool registry — maps tool names to callables and generates Anthropic
tool schemas automatically."""

from __future__ import annotations

import inspect
import json
from typing import Any, Callable, Awaitable, get_type_hints

ToolFn = Callable[..., Awaitable[Any]]


class ToolRegistry:
    """Collects tool functions and produces the ``tools`` list that the
    Anthropic API expects."""

    def __init__(self) -> None:
        self._tools: dict[str, ToolFn] = {}
        self._schemas: dict[str, dict[str, Any]] = {}

    def register(
        self,
        name: str,
        description: str,
        input_schema: dict[str, Any],
        fn: ToolFn,
    ) -> None:
        self._tools[name] = fn
        self._schemas[name] = {
            "name": name,
            "description": description,
            "input_schema": input_schema,
        }

    def tool(
        self,
        name: str,
        description: str,
        input_schema: dict[str, Any],
    ) -> Callable[[ToolFn], ToolFn]:
        """Decorator form of ``register``."""

        def decorator(fn: ToolFn) -> ToolFn:
            self.register(name, description, input_schema, fn)
            return fn

        return decorator

    @property
    def schemas(self) -> list[dict[str, Any]]:
        """Anthropic-format ``tools`` list."""
        return list(self._schemas.values())

    async def call(self, name: str, args: dict[str, Any]) -> str:
        """Execute a tool and return the result as a JSON string."""
        fn = self._tools.get(name)
        if fn is None:
            return json.dumps({"error": f"Unknown tool: {name}"})
        try:
            result = await fn(**args)
            return json.dumps(result, ensure_ascii=False, default=str)
        except Exception as e:
            return json.dumps({"error": f"Tool '{name}' failed: {e}"})

    def has(self, name: str) -> bool:
        return name in self._tools