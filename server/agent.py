"""Thin wrapper around the Anthropic SDK for conversational agent loops."""

from __future__ import annotations

from typing import Any, Generator

from anthropic import Anthropic
from anthropic.types import Message, RawMessageStreamEvent

from server.config import LLM_BASE_URL, LLM_API_KEY, MODEL_ID


class Agent:
    """Stateless Claude agent.  Callers own the message history."""

    def __init__(self, model: str | None = None):
        self.client = Anthropic(
            base_url=LLM_BASE_URL,
            api_key=LLM_API_KEY,
        )
        self.model = model or MODEL_ID

    # ---- message helpers -----------------------------------------------------

    @staticmethod
    def user_msg(content: str | list[dict[str, Any]]) -> dict[str, Any]:
        return {"role": "user", "content": content}

    @staticmethod
    def assistant_msg(message: Message) -> dict[str, Any]:
        return {"role": "assistant", "content": message.content}

    @staticmethod
    def tool_result(tool_use_id: str, content: str, is_error: bool = False) -> dict[str, Any]:
        return {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": content,
                    "is_error": is_error,
                }
            ],
        }

    @staticmethod
    def text_from_message(message: Message) -> str:
        return "\n".join(
            block.text for block in message.content if block.type == "text"
        )

    # ---- completions ---------------------------------------------------------

    def chat(
        self,
        messages: list[dict[str, Any]],
        system: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        max_tokens: int = 8192,
        temperature: float = 1.0,
        stop_sequences: list[str] | None = None,
    ) -> Message:
        """Non-streaming completion."""
        params: dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": messages,
            "temperature": temperature,
        }
        if system:
            params["system"] = system
        if tools:
            params["tools"] = tools
        if stop_sequences:
            params["stop_sequences"] = stop_sequences

        return self.client.messages.create(**params)

    def stream(
        self,
        messages: list[dict[str, Any]],
        system: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        max_tokens: int = 8192,
        temperature: float = 1.0,
    ) -> Generator[RawMessageStreamEvent, None, Message]:
        """Streaming completion.  Yields raw stream events; the final
        ``Message`` is available as the generator's return value via
        ``stream.get_final_message()`` or by catching ``StopIteration``."""
        params: dict[str, Any] = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": messages,
            "temperature": temperature,
        }
        if system:
            params["system"] = system
        if tools:
            params["tools"] = tools

        with self.client.messages.stream(**params) as stream:
            for event in stream:
                yield event
            return stream.get_final_message()