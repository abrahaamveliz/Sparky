"""Walmart Guatemala VTEX storefront tools.

Ported from the original FastMCP server.py — same API calls, same
transforms, registered as plain async functions in the ToolRegistry.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote, urlencode

import httpx

from server.config import WALMART_BASE
from server.tools.registry import ToolRegistry

SEARCH_PATH = "/api/catalog_system/pub/products/search"
FACETS_PATH = "/api/catalog_system/pub/facets/search"
CATEGORY_TREE = "/api/catalog_system/pub/category/tree"
BRAND_LIST = "/api/catalog_system/pub/brand/list"
SUGGESTIONS = "/api/io/_v/api/intelligent-search/search_suggestions"
DEFAULT_HEADERS = {"Accept": "application/json"}


# ── helpers ──────────────────────────────────────────────────────────────

def _total_from_resources(header: str | None) -> int:
    if not header or "/" not in header:
        return 0
    try:
        return int(header.rsplit("/", 1)[1])
    except ValueError:
        return 0


def _transform(raw: dict[str, Any]) -> dict[str, Any]:
    items = raw.get("items") or [{}]
    item = items[0]
    sellers = item.get("sellers") or [{}]
    offer = (sellers[0] or {}).get("commertialOffer", {}) or {}
    slug = raw.get("linkText", "")
    return {
        "productId": raw.get("productId", ""),
        "ean": item.get("ean", ""),
        "name": raw.get("productName", ""),
        "description": raw.get("description", ""),
        "slug": slug,
        "brand": raw.get("brand", ""),
        "brandId": raw.get("brandId", 0),
        "categoryId": raw.get("categoryId", ""),
        "categories": raw.get("categories", []),
        "sellingPrice": offer.get("Price", 0),
        "listPrice": offer.get("ListPrice", 0),
        "priceWithoutDiscount": offer.get("PriceWithoutDiscount", 0),
        "availableQuantity": offer.get("AvailableQuantity", 0),
        "images": [
            {"imageUrl": img.get("imageUrl"), "imageText": img.get("imageText")}
            for img in (item.get("images") or [])
        ],
        "specifications": [
            {"name": name, "values": raw.get(name)}
            for name in (raw.get("allSpecifications") or [])
        ],
        "skus": [
            {
                "itemId": it.get("itemId"),
                "name": it.get("name"),
                "ean": it.get("ean"),
                "measurementUnit": it.get("measurementUnit"),
                "unitMultiplier": it.get("unitMultiplier"),
            }
            for it in items
        ],
        "link": f"{WALMART_BASE}/{slug}/p" if slug else None,
    }


def _build_fq(
    brand_id: int | None,
    price_min: float | None,
    price_max: float | None,
    extra_fq: list[str] | None = None,
) -> list[str]:
    fq: list[str] = []
    if brand_id is not None:
        fq.append(f"B:{brand_id}")
    if price_min is not None or price_max is not None:
        lo = price_min if price_min is not None else 0
        hi = price_max if price_max is not None else 999999
        fq.append(f"P:[{lo} TO {hi}]")
    if extra_fq:
        fq.extend(extra_fq)
    return fq


async def _get(path: str, params: Any = None) -> httpx.Response:
    url = f"{WALMART_BASE}{path}"
    if params:
        url = f"{url}?{urlencode(params, quote_via=quote)}"
    async with httpx.AsyncClient(timeout=30.0, headers=DEFAULT_HEADERS) as client:
        resp = await client.get(url)
        if resp.status_code not in (200, 206):
            resp.raise_for_status()
        return resp


def _trim_category(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": node.get("id"),
        "name": node.get("name"),
        "slug": (node.get("url") or "").rstrip("/").rsplit("/", 1)[-1],
        "hasChildren": node.get("hasChildren", False),
        "url": node.get("url"),
        "children": [_trim_category(c) for c in (node.get("children") or [])],
    }


# ── reusable search (used by both the tool and the pagination endpoint) ─

async def do_product_search(
    query: str | None = None,
    category: str | None = None,
    brand_id: int | None = None,
    price_min: float | None = None,
    price_max: float | None = None,
    start: int = 0,
    end: int = 19,
    order_by: str = "OrderByScoreDESC",
) -> dict[str, Any]:
    """Run a VTEX catalog search and return transformed products."""
    path = f"{SEARCH_PATH}/{category}" if category else SEARCH_PATH
    params: list[tuple[str, Any]] = [
        ("_from", start),
        ("_to", end),
        ("O", order_by),
    ]
    if query:
        params.append(("ft", query))
    if category:
        params.append(("map", "c"))
    for clause in _build_fq(brand_id, price_min, price_max):
        params.append(("fq", clause))

    resp = await _get(path, params)
    total = _total_from_resources(resp.headers.get("resources"))
    raw_products = resp.json() or []
    return {
        "total": total,
        "start": start,
        "end": start + len(raw_products) - 1 if raw_products else start,
        "products": [_transform(p) for p in raw_products],
    }


# ── reusable browse (used by both the tool and the pagination endpoint) ─

async def do_browse_category(
    category_path: str,
    brand_id: int | None = None,
    price_min: float | None = None,
    price_max: float | None = None,
    start: int = 0,
    end: int = 19,
    order_by: str = "OrderByScoreDESC",
) -> dict[str, Any]:
    """Browse products in a category path (no search term)."""
    depth = len([s for s in category_path.split("/") if s])
    params: list[tuple[str, Any]] = [
        ("_from", start),
        ("_to", end),
        ("O", order_by),
        ("map", ",".join(["c"] * depth)),
    ]
    for clause in _build_fq(brand_id, price_min, price_max):
        params.append(("fq", clause))

    resp = await _get(f"{SEARCH_PATH}/{category_path.strip('/')}", params)
    total = _total_from_resources(resp.headers.get("resources"))
    raw_products = resp.json() or []
    return {
        "total": total,
        "start": start,
        "end": start + len(raw_products) - 1 if raw_products else start,
        "products": [_transform(p) for p in raw_products],
    }


# ── tool registration ───────────────────────────────────────────────────

def register_walmart_tools(registry: ToolRegistry) -> None:
    """Register all Walmart Guatemala catalog tools."""

    @registry.tool(
        name="search_products",
        description=(
            "Search the Walmart Guatemala catalog with optional filters. "
            "At least one of `query` or `category` should be provided. "
            "When a category-scoped search returns few results, the server "
            "automatically retries without the category. The response will "
            "include `category_fallback: true` when this happens."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Full-text search term in Spanish (e.g. 'paracetamol', 'leche').",
                },
                "category": {
                    "type": "string",
                    "description": "Top-level category slug (e.g. 'farmacia', 'lacteos'). Call list_categories to discover them.",
                },
                "brand_id": {
                    "type": "integer",
                    "description": "Numeric brand id. Call list_brands to find ids.",
                },
                "price_min": {
                    "type": "number",
                    "description": "Minimum price (Quetzales, inclusive).",
                },
                "price_max": {
                    "type": "number",
                    "description": "Maximum price (Quetzales, inclusive).",
                },
                "start": {
                    "type": "integer",
                    "description": "0-based pagination start. Default 0.",
                    "default": 0,
                },
                "end": {
                    "type": "integer",
                    "description": "Pagination end (inclusive). Default 19. Max window = 50.",
                    "default": 19,
                },
                "order_by": {
                    "type": "string",
                    "description": "Sort order. Default OrderByScoreDESC.",
                    "default": "OrderByScoreDESC",
                    "enum": [
                        "OrderByScoreDESC",
                        "OrderByPriceASC",
                        "OrderByPriceDESC",
                        "OrderByTopSaleDESC",
                        "OrderByReleaseDateDESC",
                        "OrderByNameASC",
                        "OrderByNameDESC",
                        "OrderByBestDiscountDESC",
                    ],
                },
            },
        },
    )
    async def search_products(
        query: str | None = None,
        category: str | None = None,
        brand_id: int | None = None,
        price_min: float | None = None,
        price_max: float | None = None,
        start: int = 0,
        end: int = 19,
        order_by: str = "OrderByScoreDESC",
    ) -> dict[str, Any]:
        result = await do_product_search(
            query=query, category=category, brand_id=brand_id,
            price_min=price_min, price_max=price_max,
            start=start, end=end, order_by=order_by,
        )

        # Auto-fallback: if a category-scoped search returned few results
        # and we have a query, retry without the category. VTEX relevance
        # ranking handles routing well, so this catches mis-routed queries
        # (e.g. "ventilador" in articulos-para-el-hogar returns 1 BBQ fan,
        # but uncategorized search finds 57 real fans).
        FALLBACK_THRESHOLD = 3
        if category and query and result["total"] <= FALLBACK_THRESHOLD:
            uncategorized = await do_product_search(
                query=query, category=None, brand_id=brand_id,
                price_min=price_min, price_max=price_max,
                start=start, end=end, order_by=order_by,
            )
            if uncategorized["total"] > result["total"]:
                uncategorized["category_fallback"] = True
                result = uncategorized

        return result

    @registry.tool(
        name="browse_category",
        description=(
            "Browse products in a category (no search term). "
            "Supports nested categories via slash-separated paths."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "category_path": {
                    "type": "string",
                    "description": "Slug path (e.g. 'farmacia', 'farmacia/otc').",
                },
                "brand_id": {"type": "integer", "description": "Optional brand filter."},
                "price_min": {"type": "number", "description": "Min price (Quetzales)."},
                "price_max": {"type": "number", "description": "Max price (Quetzales)."},
                "start": {"type": "integer", "default": 0},
                "end": {"type": "integer", "default": 19},
                "order_by": {"type": "string", "default": "OrderByScoreDESC"},
            },
            "required": ["category_path"],
        },
    )
    async def browse_category(
        category_path: str,
        brand_id: int | None = None,
        price_min: float | None = None,
        price_max: float | None = None,
        start: int = 0,
        end: int = 19,
        order_by: str = "OrderByScoreDESC",
    ) -> dict[str, Any]:
        return await do_browse_category(
            category_path=category_path, brand_id=brand_id,
            price_min=price_min, price_max=price_max,
            start=start, end=end, order_by=order_by,
        )

    @registry.tool(
        name="count_products",
        description="Total matches for a query/filter combination. Useful for pagination.",
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "category": {"type": "string"},
                "brand_id": {"type": "integer"},
                "price_min": {"type": "number"},
                "price_max": {"type": "number"},
            },
        },
    )
    async def count_products(
        query: str | None = None,
        category: str | None = None,
        brand_id: int | None = None,
        price_min: float | None = None,
        price_max: float | None = None,
    ) -> int:
        path = f"{SEARCH_PATH}/{category}" if category else SEARCH_PATH
        params: list[tuple[str, Any]] = [("_from", 0), ("_to", 0)]
        if query:
            params.append(("ft", query))
        if category:
            params.append(("map", "c"))
        for clause in _build_fq(brand_id, price_min, price_max):
            params.append(("fq", clause))
        resp = await _get(path, params)
        return _total_from_resources(resp.headers.get("resources"))

    @registry.tool(
        name="get_product_by_slug",
        description='Fetch a single product by URL slug (e.g. "tylenol-extra-fuerte-50-capsulas").',
        input_schema={
            "type": "object",
            "properties": {
                "slug": {"type": "string", "description": "Product URL slug."},
            },
            "required": ["slug"],
        },
    )
    async def get_product_by_slug(slug: str) -> dict[str, Any] | None:
        resp = await _get(f"{SEARCH_PATH}/{slug}/p", None)
        data = resp.json() or []
        return _transform(data[0]) if data else None

    @registry.tool(
        name="get_product_by_id",
        description="Fetch a single product by numeric VTEX productId.",
        input_schema={
            "type": "object",
            "properties": {
                "product_id": {"type": "integer", "description": "Numeric product ID."},
            },
            "required": ["product_id"],
        },
    )
    async def get_product_by_id(product_id: int) -> dict[str, Any] | None:
        params = [("fq", f"productId:{product_id}"), ("_from", 0), ("_to", 0)]
        resp = await _get(SEARCH_PATH, params)
        data = resp.json() or []
        return _transform(data[0]) if data else None

    @registry.tool(
        name="list_categories",
        description="Return the Walmart GT category tree.",
        input_schema={
            "type": "object",
            "properties": {
                "depth": {
                    "type": "integer",
                    "description": "Levels to descend (1 = top-level). Default 3.",
                    "default": 3,
                },
            },
        },
    )
    async def list_categories(depth: int = 3) -> list[dict[str, Any]]:
        resp = await _get(f"{CATEGORY_TREE}/{depth}", None)
        tree = resp.json() or []
        return [_trim_category(n) for n in tree]

    @registry.tool(
        name="list_brands",
        description=(
            "List brands in the catalog. ~6400 brands — always filter with "
            "name_contains unless you need a big dump."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "name_contains": {
                    "type": "string",
                    "description": "Case-insensitive substring filter.",
                },
                "active_only": {"type": "boolean", "default": True},
                "limit": {"type": "integer", "default": 50},
            },
        },
    )
    async def list_brands(
        name_contains: str | None = None,
        active_only: bool = True,
        limit: int = 50,
    ) -> dict[str, Any]:
        resp = await _get(BRAND_LIST, None)
        brands = resp.json() or []
        if active_only:
            brands = [b for b in brands if b.get("isActive")]
        if name_contains:
            needle = name_contains.lower()
            brands = [b for b in brands if needle in (b.get("name") or "").lower()]
        sliced = brands[:limit]
        return {
            "total": len(brands),
            "returned": len(sliced),
            "brands": [
                {"id": b.get("id"), "name": b.get("name"), "isActive": b.get("isActive")}
                for b in sliced
            ],
        }

    @registry.tool(
        name="get_facets",
        description=(
            "Return available filters (brands, price ranges, specs) for a search context. "
            "Must provide query and/or category."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "category": {"type": "string"},
            },
        },
    )
    async def get_facets(
        query: str | None = None,
        category: str | None = None,
    ) -> dict[str, Any]:
        if not query and not category:
            return {
                "error": "Provide at least one of query or category.",
                "brands": [],
                "priceRanges": [],
                "specificationFilters": [],
                "categoriesTrees": [],
            }

        parts: list[str] = []
        maps: list[str] = []
        if category:
            parts.append(category.strip("/"))
            maps.extend(["c"] * len([s for s in category.split("/") if s]))
        if query:
            parts.append(query)
            maps.append("ft")

        path = f"{FACETS_PATH}/{'/'.join(parts)}"
        resp = await _get(path, [("map", ",".join(maps))])
        data = resp.json() or {}

        return {
            "brands": [
                {"id": b.get("Id"), "name": b.get("Name"), "quantity": b.get("Quantity")}
                for b in (data.get("Brands") or [])
            ],
            "priceRanges": [
                {"slug": p.get("Slug"), "name": p.get("Name"), "quantity": p.get("Quantity")}
                for p in (data.get("PriceRanges") or [])
            ],
            "specificationFilters": [
                {
                    "name": sf.get("Name"),
                    "values": [
                        {"name": v.get("Name"), "quantity": v.get("Quantity")}
                        for v in (sf.get("Values") or [])
                    ],
                }
                for sf in (data.get("SpecificationFilters") or [])
            ],
            "categoriesTrees": data.get("CategoriesTrees") or [],
        }

    @registry.tool(
        name="autocomplete",
        description="Suggest search terms related to a term. Returns [{term, count}].",
        input_schema={
            "type": "object",
            "properties": {
                "term": {"type": "string", "description": "Partial search term."},
            },
            "required": ["term"],
        },
    )
    async def autocomplete(term: str) -> list[dict[str, Any]]:
        resp = await _get(SUGGESTIONS, [("query", term), ("locale", "es-GT")])
        data = resp.json() or {}
        return [
            {"term": s.get("term"), "count": s.get("count", 0)}
            for s in (data.get("searches") or [])
        ]