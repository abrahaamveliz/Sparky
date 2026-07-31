"""POST /api/products/page — direct VTEX pagination (no LLM)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from server.tools.walmart import do_browse_category, do_product_search

router = APIRouter()


@router.post("/api/products/page")
async def products_page(request: Request) -> JSONResponse:
    body: dict[str, Any] = await request.json()

    # Clamp window to VTEX max of 50 items
    start = max(int(body.get("start", 0)), 0)
    end = int(body.get("end", start + 49))
    if end - start >= 50:
        end = start + 49

    category_path = body.get("category_path")

    # Use browse_category semantics when the original results came from
    # browse_category (identified by the presence of category_path).
    if category_path:
        result = await do_browse_category(
            category_path=category_path,
            brand_id=body.get("brand_id"),
            price_min=body.get("price_min"),
            price_max=body.get("price_max"),
            start=start,
            end=end,
            order_by=body.get("order_by", "OrderByScoreDESC"),
        )
    else:
        result = await do_product_search(
            query=body.get("query"),
            category=body.get("category"),
            brand_id=body.get("brand_id"),
            price_min=body.get("price_min"),
            price_max=body.get("price_max"),
            start=start,
            end=end,
            order_by=body.get("order_by", "OrderByScoreDESC"),
        )
    return JSONResponse(content=result)