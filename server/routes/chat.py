"""POST /api/chat — agentic loop with SSE streaming.

Protocol: Server-Sent Events where each event is one of:
  event: text       data: {"content": "..."}
  event: tool_call  data: {"id": "...", "name": "...", "input": {...}}
  event: tool_result data: {"id": "...", "name": "...", "result": ..., "is_error": false}
  event: done       data: {}
  event: error      data: {"message": "..."}

The frontend reads these with EventSource or fetch+ReadableStream and
renders accordingly.
"""

from __future__ import annotations

import json
import re
from typing import Any, AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from server.agent import Agent
from server.tools import get_tools
from server.prompts import build_system_prompt

router = APIRouter()

MAX_AGENT_STEPS = 8

# Regex to strip leaked tool-call XML that some inference proxies emit as
# text instead of structured tool_use blocks.
_TOOL_LEAK_RE = re.compile(
    r"<tool_call[^>]*>.*?</tool_call>|<tool_call[^>]*>.*",
    re.DOTALL,
)

_NARRATION_RE = re.compile(
    r"(?:^|\n).*?(?:"
    r"Intenté|intenté|I tried|i tried|"
    r"los primeros resultados muestran|"
    r"el sistema devolvió|"
    r"no encontré|No encontré|"
    r"resultados de otras categorías|"
    r"I can see that|"
    r"Let me (?:try|search|show)|"
    r"Déjame (?:intentar|buscar)"
    r")[^\n]*",
    re.IGNORECASE,
)


def _strip_tool_leaks(text: str) -> str:
    """Remove leaked tool-call XML and retry narration from model output."""
    text = _TOOL_LEAK_RE.sub("", text)
    text = _NARRATION_RE.sub("", text)
    return text


_PRODUCT_TOOLS = {"search_products", "browse_category", "get_product_by_slug", "get_product_by_id"}

# Subcategory → search hint mapping. When a user message matches one of
# these patterns, we inject a routing hint into the message so the model
# calls search_products with the right query+category on the first try,
# instead of browse_category on the parent category.
# Subcategory routing: only genuine store-section names that need routing
# to search_products instead of browse_category. Product-specific terms
# (creatina, papilla, etc.) are NOT here — the server's auto-fallback
# handles category mismatches for individual products.
_SUBCATEGORY_MAP: dict[str, str] = {
    # Electronics sub-sections (the model often tries browse_category on these)
    "fotografía": 'Use search_products(query="fotografía", category="electronica")',
    "fotografia": 'Use search_products(query="fotografía", category="electronica")',
    "photography": 'Use search_products(query="fotografía", category="electronica")',
    "seguridad": 'Use search_products(query="seguridad", category="electronica")',
    "security": 'Use search_products(query="seguridad", category="electronica")',
    "audio": 'Use search_products(query="audio", category="electronica")',
    "computación": 'Use search_products(query="computación", category="electronica")',
    "computacion": 'Use search_products(query="computación", category="electronica")',
    "impresión": 'Use search_products(query="impresora", category="electronica")',
    "printing": 'Use search_products(query="impresora", category="electronica")',
    # Personal care sub-sections
    "cuidado bucal": 'Use search_products(query="cuidado bucal", category="higiene-y-belleza")',
    "oral care": 'Use search_products(query="cuidado bucal", category="higiene-y-belleza")',
    "cuidado capilar": 'Use search_products(query="cuidado del cabello", category="higiene-y-belleza")',
    "hair care": 'Use search_products(query="cuidado del cabello", category="higiene-y-belleza")',
    "cuidado facial": 'Use search_products(query="cuidado facial", category="higiene-y-belleza")',
    "skincare": 'Use search_products(query="cuidado facial", category="higiene-y-belleza")',
    # Grocery sub-sections
    "snacks": 'Use search_products(query="snacks", category="abarrotes")',
    "condimentos": 'Use search_products(query="condimentos", category="abarrotes")',
    "bebidas calientes": 'Use search_products(query="café té", category="abarrotes")',
    "cereales": 'Use search_products(query="cereal", category="abarrotes")',
    "embutidos": 'Use search_products(query="embutidos", category="carnes-embutidos-y-mariscos")',
    # Home sub-sections
    "iluminación": 'Use search_products(query="iluminación", category="articulos-para-el-hogar")',
    "lighting": 'Use search_products(query="iluminación", category="articulos-para-el-hogar")',
}


def _subcategory_hint(text: str) -> str | None:
    """Check if the user's message contains a known subcategory name."""
    # Strip common prefixes
    for prefix in ("buscar productos en ", "productos de ", "ver ", "mostrar ", "show me ", "search "):
        if text.startswith(prefix):
            text = text[len(prefix):]
            break

    text = text.strip().rstrip(".")

    # Exact match
    if text in _SUBCATEGORY_MAP:
        return _SUBCATEGORY_MAP[text]

    # Substring match (e.g. "productos de fotografía y video")
    for key, hint in _SUBCATEGORY_MAP.items():
        if key in text:
            return hint

    return None


def _condense_for_model(tool_name: str, result_str: str, is_error: bool) -> str:
    """Produce a condensed version of tool results for the model.

    Product search results are stripped down to name+brand+price (enough
    for the model to write prose). Non-product tools pass through unchanged.
    This reduces input tokens from ~75KB to ~2KB per search call, making
    the follow-up model call 5-10x faster.
    """
    if is_error or tool_name not in _PRODUCT_TOOLS:
        return result_str

    try:
        data = json.loads(result_str)
    except (json.JSONDecodeError, TypeError):
        return result_str

    if not isinstance(data, dict):
        return result_str

    products = data.get("products")
    if not isinstance(products, list):
        return result_str

    condensed_products = []
    for p in products:
        if not isinstance(p, dict):
            continue
        condensed_products.append({
            "name": p.get("name", ""),
            "brand": p.get("brand", ""),
            "sellingPrice": p.get("sellingPrice"),
            "listPrice": p.get("listPrice"),
            "productId": p.get("productId", ""),
        })

    condensed = {
        "total": data.get("total", len(condensed_products)),
        "products": condensed_products,
    }
    return json.dumps(condensed, ensure_ascii=False)


def _sse(event: str, data: Any) -> str:
    """Format a single SSE message."""
    payload = json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


async def _agent_loop(
    messages: list[dict[str, Any]],
    system: str,
    tools_schemas: list[dict[str, Any]],
    agent: Agent,
    registry: Any,
) -> AsyncGenerator[str, None]:
    """Run the agentic loop with streaming text output.

    Text tokens stream as they arrive. Tool calls are collected from the
    stream and emitted after the full response, then executed. The loop
    repeats until end_turn or step limit.
    """

    steps = 0
    while steps < MAX_AGENT_STEPS:
        steps += 1

        try:
            # Use streaming to send text tokens in real-time
            text_buffer = ""
            tool_uses: list[dict[str, Any]] = []
            current_tool: dict[str, Any] | None = None
            current_tool_json = ""
            stop_reason = None

            with agent.client.messages.stream(
                model=agent.model,
                max_tokens=8192,
                messages=messages,
                system=system,
                tools=tools_schemas,
            ) as stream:
                for event in stream:
                    etype = event.type

                    if etype == "content_block_start":
                        block = event.content_block
                        if block.type == "tool_use":
                            current_tool = {
                                "id": block.id,
                                "name": block.name,
                                "input": {},
                            }
                            current_tool_json = ""

                    elif etype == "content_block_delta":
                        delta = event.delta
                        if delta.type == "text_delta" and delta.text:
                            text_buffer += delta.text
                            # Stream text to client immediately
                            clean = _strip_tool_leaks(delta.text)
                            if clean:
                                yield _sse("text", {"content": clean})

                        elif delta.type == "input_json_delta" and delta.partial_json:
                            current_tool_json += delta.partial_json

                    elif etype == "content_block_stop":
                        if current_tool is not None:
                            # Parse the accumulated JSON for this tool call
                            try:
                                current_tool["input"] = json.loads(current_tool_json) if current_tool_json else {}
                            except json.JSONDecodeError:
                                current_tool["input"] = {}

                            tool_uses.append(current_tool)
                            yield _sse("tool_call", {
                                "id": current_tool["id"],
                                "name": current_tool["name"],
                                "input": current_tool["input"],
                            })
                            current_tool = None
                            current_tool_json = ""

                    elif etype == "message_delta":
                        if hasattr(event, 'delta') and hasattr(event.delta, 'stop_reason'):
                            stop_reason = event.delta.stop_reason

                response = stream.get_final_message()
                if stop_reason is None:
                    stop_reason = response.stop_reason

        except Exception as e:
            yield _sse("error", {"message": str(e)})
            return

        # If no tool calls, we're done
        if not tool_uses:
            break

        # Add assistant message to history
        serialized_content = []
        for block in response.content:
            if block.type == "text":
                serialized_content.append({"type": "text", "text": block.text})
            elif block.type == "tool_use":
                serialized_content.append({
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                })
        messages.append({"role": "assistant", "content": serialized_content})

        # Execute tools and build result message
        tool_results_for_model: list[dict[str, Any]] = []
        for tool_use in tool_uses:
            result_str = await registry.call(tool_use["name"], tool_use["input"])
            is_error = False
            try:
                parsed = json.loads(result_str)
                if isinstance(parsed, dict) and "error" in parsed:
                    is_error = True
            except json.JSONDecodeError:
                parsed = None

            # Send FULL result to frontend (for product card rendering)
            yield _sse("tool_result", {
                "id": tool_use["id"],
                "name": tool_use["name"],
                "result": parsed if parsed is not None and not is_error else result_str,
                "is_error": is_error,
            })

            # For the model, send a CONDENSED version of product results
            # to reduce input tokens and speed up the next model call.
            model_content = _condense_for_model(
                tool_use["name"], result_str, is_error,
            )

            tool_results_for_model.append({
                "type": "tool_result",
                "tool_use_id": tool_use["id"],
                "content": model_content,
                "is_error": is_error,
            })

        messages.append({"role": "user", "content": tool_results_for_model})

        # Stop the loop when the turn is logically complete:
        # - model signaled end_turn
        # - propose_followups was called AND the model already wrote prose
        #   (if it called propose_followups without text, let the loop
        #   continue so the model can write its summary after seeing
        #   tool results — breaking early leaves the user with no prose)
        if stop_reason == "end_turn":
            break
        has_followups = any(t["name"] == "propose_followups" for t in tool_uses)
        has_prose = bool(text_buffer.strip())
        if has_followups and has_prose:
            break
        # If propose_followups was the ONLY tool (no product tools) and
        # there's no prose, the model is just emitting chips — stop.
        if has_followups and not any(t["name"] in _PRODUCT_TOOLS for t in tool_uses):
            break

    yield _sse("done", {})


@router.post("/api/chat")
async def chat(request: Request) -> StreamingResponse:
    body = await request.json()
    user_messages: list[dict[str, Any]] = body.get("messages", [])
    locale: str = body.get("locale", "es")
    preferences: dict[str, Any] | None = body.get("preferences")

    system = build_system_prompt(locale=locale, preferences=preferences)

    # Pre-process: route category nav clicks and known subcategory names.
    if user_messages:
        last_msg = user_messages[-1]
        content = (last_msg.get("content") or "") if isinstance(last_msg, dict) else ""
        if isinstance(content, str):
            # 1. Explicit [category:slug-path] tag from the mega menu
            cat_match = re.search(r"\[category:([a-z0-9/_-]+)\]", content)
            if cat_match:
                slug_path = cat_match.group(1).strip("/")
                clean_text = content[:cat_match.start()].strip()
                hint = f'Use browse_category(category_path="{slug_path}")'
                rewritten = f"{clean_text}\n\n[System routing hint: {hint}]"
                user_messages = [*user_messages[:-1], {**last_msg, "content": rewritten}]
            else:
                # 2. Fallback: match known subcategory names for typed messages
                hint = _subcategory_hint(content.lower().strip())
                if hint:
                    rewritten = f"{content}\n\n[System routing hint: {hint}]"
                    user_messages = [*user_messages[:-1], {**last_msg, "content": rewritten}]

    agent = Agent()
    registry = get_tools()

    # Add propose_followups as a tool schema (client-side — just echoes input)
    followups_schema = {
        "name": "propose_followups",
        "description": (
            "Call at the END of every turn to suggest 2-4 followup actions. "
            "Each has a short label (max 4 words, UI locale) and a prompt "
            "(full message in Spanish)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "suggestions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {"type": "string", "description": "Short chip label, max 4 words."},
                            "prompt": {"type": "string", "description": "Full message in Spanish."},
                        },
                        "required": ["label", "prompt"],
                    },
                    "minItems": 2,
                    "maxItems": 4,
                },
            },
            "required": ["suggestions"],
        },
    }

    # Register a passthrough handler for propose_followups
    async def _followups_handler(**kwargs: Any) -> dict[str, Any]:
        return kwargs

    registry.register("propose_followups", followups_schema["description"], followups_schema["input_schema"], _followups_handler)

    all_tool_schemas = registry.schemas

    async def generate() -> AsyncGenerator[str, None]:
        async for chunk in _agent_loop(
            messages=user_messages,
            system=system,
            tools_schemas=all_tool_schemas,
            agent=agent,
            registry=registry,
        ):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )