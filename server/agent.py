"""Thin wrapper around the OpenAI SDK for conversational agent loops."""

from __future__ import annotations

from typing import Any

from openai import OpenAI

from server.config import LLM_BASE_URL, LLM_API_KEY, MODEL_ID


class Agent:
    """Stateless chat agent.  Callers own the message history."""

    def __init__(self, model: str | None = None):
        self.client = OpenAI(
            base_url=LLM_BASE_URL,
            api_key=LLM_API_KEY,
        )
        self.model = model or MODEL_ID

    # ---- message helpers -----------------------------------------------------

    @staticmethod
    def user_msg(content: str | list[dict[str, Any]]) -> dict[str, Any]:
        return {"role": "user", "content": content}

    @staticmethod
    def assistant_msg(
        content: str | None = None,
        tool_calls: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        msg: dict[str, Any] = {"role": "assistant"}
        if content:
            msg["content"] = content
        if tool_calls:
            msg["tool_calls"] = tool_calls
        return msg

    @staticmethod
    def tool_result(tool_call_id: str, content: str) -> dict[str, Any]:
        return {
            "role": "tool",
            "tool_call_id": tool_call_id,
            "content": content,
        }

    # ---- completions ---------------------------------------------------------

    def chat(
        self,
        messages: list[dict[str, Any]],
        system: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        max_tokens: int = 8192,
        temperature: float = 1.0,
        stop: list[str] | None = None,
    ):
        """Non-streaming completion."""
        full_messages = self._with_system(messages, system)
        params: dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": full_messages,
            "temperature": temperature,
        }
        if tools:
            params["tools"] = tools
        if stop:
            params["stop"] = stop

        return self.client.chat.completions.create(**params)

    def stream(
        self,
        messages: list[dict[str, Any]],
        system: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        max_tokens: int = 8192,
        temperature: float = 1.0,
    ):
        """Streaming completion.  Returns an iterator of ChatCompletionChunk."""
        full_messages = self._with_system(messages, system)
        params: dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": full_messages,
            "temperature": temperature,
            "stream": True,
        }
        if tools:
            params["tools"] = tools

        return self.client.chat.completions.create(**params)

    @staticmethod
    def _with_system(
        messages: list[dict[str, Any]], system: str | None
    ) -> list[dict[str, Any]]:
        """Prepend a system message if provided."""
        if system:
            return [{"role": "system", "content": system}, *messages]
        return messages