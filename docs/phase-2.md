Walmart GT (VTEX) — API Analysis for an MCP Server
Status: draft, based on live testing against https://www.walmart.com.gt on 2026-07-03.
1. The two candidate approaches


Script A — GraphQL persisted query
Script B — REST catalog_system + FastMCP
Endpoint
POST/GET /_v/segment/graphql/v1
GET /api/catalog_system/pub/*
Auth mechanism
sha256Hash of a persisted query, tied to a specific deployed version of a VTEX IO app (vtex.store-resources, vtex.shelf, etc.)
None — plain public REST, no hash
Stability
Fragile. The hash we started with (9177ba6f...) was already dead (PersistedQueryNotFoundError). We captured a working replacement (b398fc0a...) live from the browser's Network tab, but it will die again the next time Walmart GT redeploys its search app — there is no way to predict when.
Stable. This is VTEX's long-standing public storefront API, unchanged across deployments. All REST calls made during this session returned 200/206 with no auth.
Current state
Confirmed working for productSearchV3 (text search + facets), Products (vtex.shelf, collection carousels), autocompleteSearchSuggestions, productSuggestions, facetsV2, correction, banners — hashes captured 2026-07-03.
Already implemented as a working FastMCP server with 9 tools: search, browse, count, get-by-slug/id, categories, brands, facets, autocomplete. Verified live.
Unique capability over REST
Richer facetsV2 (spec filters), productSuggestions/autocompleteSearchSuggestions (no REST equivalent)
None — REST already covers full-text search, category browsing, brand list, facets, basic suggestions
Maintenance cost
Every hash can rot independently; requires re-capturing from DevTools each time, decoding the base64 variables blob to confirm the operation still matches
None


Verdict: build on Script B (REST + FastMCP). It already does everything Script A's core use case (paginated product search/export) needs, without the hash-rotation liability. Script A's GraphQL layer is worth keeping only as a fallback for the two things REST can't do (rich autocomplete/spell-correction), added as optional, clearly-labeled "may break" tools.
2. The store-selection question — what we actually found
The goal was: let the MCP pick a store/locality, the way the site does when you enter a postal code, so that subsequent product results reflect that store's real inventory/price.

We reverse-engineered the full front-end flow from the captured cURLs and tested each step directly:

GET /api/checkout/pub/regions?country=GTM&sc=1&postalCode={cp} Public, no cookies required. Returns the sellers (stores) that cover a postal code:

[{

  "id": "U1cj...",

  "sellers": [

    {"id": "andreisostore454", "name": "Andreiso store"},

    {"id": "walmartgtwm459",  "name": "WM-BOSQ SAN NICOLAS"},

    {"id": "walmartgtwm948",  "name": "WM - NARANJO"}

  ]

}]

This works today and needs no session. It's the best available "find stores near this postal code" primitive — gives real store names and their internal sellerId. No address/geo-coordinates in the response, though (that appears to live client-side, already known before estimateShipping is called).

PATCH /api/sessions with {"public":{"facets":{"value":"accesscontrollist=<sellerId>;"}}} This is what the site does right after you pick a store — it scopes the session's segment to that store's seller ID. We reproduced it: it returns 201 and sets vtex_session / vtex_segment cookies correctly.

updateSession (GraphQL, vtex.session-client) — persists regionId, postalCode, geoCoordinates, and a full selectedStore object (name, sellerId, address, lat/lng, distance) into the session. This is where the address/geo for a store would come from client-side — but it doesn't originate the data, it just stores what the client already had (presumably from estimateShipping, see below).

estimateShipping (GraphQL, vtex.checkout-resources, private endpoint _v/private/graphql/v1) — takes an address (postal code + geo-coordinates) and presumably returns nearby pickup points/stores with full address + distance. We did not manage to test this one meaningfully: it's a checkout-scoped, private mutation that expects context from an existing orderForm (cart), and typically only returns pickup options for whatever is currently in the cart. Reproducing it standalone would require first creating an orderForm and adding at least one SKU — a much heavier integration than anything else discussed here.

getExpressData/{sellerId} — looked like express-delivery ETA info for the selected store; not tested in depth, secondary priority.
The critical negative result
We tested whether setting accesscontrollist=<sellerId> (step 2, reproduced faithfully with a real session/cookie jar) changes what a product search returns — i.e., does scoping the session to "WM-BOSQ SAN NICOLAS" make AvailableQuantity/price reflect that specific store?

No facet (anonymous):        seller "1" (Walmart GTM), qty=10000, price=16.6

Facet walmartgtwm459:        seller "1" (Walmart GTM), qty=10000, price=16.6

Facet walmartgtwm948:        seller "1" (Walmart GTM), qty=10000, price=16.6

Identical, tested against both the REST products/search endpoint and the GraphQL productSearchV3 (with the same scoped session/cookies applied to both). We also tried the documented VTEX-style seller filters directly:

fq=seller:<id>   -> 400 Invalid Parameter, seller.

&seller=<id>     -> 200, but silently ignored (same 34,067 total every time)

Conclusion at the time: on this VTEX account's configuration, the public catalog/search surface (REST or GraphQL) always resolves to a single default marketplace seller (sellerId: "1", "Walmart GTM") regardless of session scoping. Every product we sampled is fulfilled from a central/virtual seller, not from the specific physical-store sellers (walmartgtwm459, etc.) — at least for search/listing purposes.

⚠️ SUPERSEDED by section 3c below. The accesscontrollist session-facet approach genuinely is a dead end (confirmed no-op), but that's not the mechanism VTEX actually uses for per-store logistics. We found and validated the real one — see 3c. Keeping this section intact because the negative result (facet scoping doesn't work) is still true and worth knowing, it just isn't the whole story.
3. Recommendation (updated after 3c — see below for the full picture)
Phase 1 (safe to build now, unchanged): Extend the existing REST-based MCP (Script B) with:

find_stores_near_postal_code(postal_code: str) -> list[{seller_id, name}] — wraps /api/checkout/pub/regions. Stateless, no cookies, no hash. Works today. Good for a lightweight "which stores serve my area" lookup with zero session/cart overhead.

Phase 2 is now validated and buildable — see section 3c for the confirmed flow and section 3d for the concrete MCP tool design. The original pessimistic take below (kept for the record) turned out to be about the wrong mechanism.

Not recommended: trying to force store-scoping through accesscontrollist session facets on the search endpoints — empirically confirmed to be a no-op for this account. Catalog search will always show the generic seller "1" regardless of session/facets; that part of the original finding still holds.
3b. Follow-up: extracting hashes straight from the JS bundle (no more DevTools hunting)
A cleaner way to get persisted-query hashes surfaced: the front-end doesn't invent hashes on the fly — they're compiled into the app's JS bundle, one per operation, alongside the full, human-readable GraphQL SDL (queries, mutations, fragments) as a plain string. That means we can download one bundle URL and extract every hash + schema for an entire VTEX app in one shot, instead of capturing each interaction manually in the Network tab.

Method: fetch the bundle URL from walmartgt.vtexassets.com/.../asset-<hash>.min.js?files=<app>@<version>,<Op1>,<Op2>,..., then regex for 64-char hex strings ([0-9a-f]{64}) and the nearest preceding OperationDefinition...name:{kind:"Name",value:"<opName>"} to map hash → operation name. The bundle also embeds i.loc.source={body:'...'} — the literal .graphql source — so the full field list of every type is readable, no guessing.

Applied to vtex.checkout-resources@0.50.1, this gave us the complete checkout mutation set:

Operation
Hash
estimateShipping
a9501638ad78be6fa9980954e9487aebd3f147823b79568a530e23da25481ce8
selectPickupOption
d9f2246b1afbc7d30207b71f36bdd4ead74566b83e3c400be11ca66287c4c1fc
selectDeliveryOption
567093498d80c38f2a1dfe9ba879a60e6256bb981eeb29a583988b4bb05f5af1
UpdateSelectedAddress
df64ce690840c56d27634714a547181f9369aec98d472bd3da775f1a36c433f6
ClearOrderFormMessages
20ae0c35fafbd560c8cf33986aff7e528bc83b2f0460c1b4face03395bf37cae
orderForm (query)
0e4744147dc063d889099111536c3c8bb748a31ab1cdc610d8ea7843f1724591


And critically, the extracted SDL shows exactly what estimateShipping/selectPickupOption return — OrderFormFragment.shipping.pickupOptions:

pickupOptions {

  id                # <- this is the pickupOptionId selectPickupOption takes

  address { ...Address }   # full street/city/neighborhood/postalCode + geoCoordinates

  deliveryChannel

  price

  estimate

  isSelected

  friendlyName      # store display name, e.g. "BOSQ SAN NICOLAS"

  additionalInfo

  storeDistance

  transitTime

  businessHours { dayNumber closed closingTime openingTime }

}

This is the real store directory we were looking for in section 2 — full address, geo, distance, and business hours per store, keyed by pickupOptionId. It doesn't exist as a standalone public endpoint; it only comes back as a side effect of estimateShipping.

Live test, and where it stalled: selectPickupOption's hash resolved fine (no PersistedQueryNotFoundError), confirming the hash is current. We drove the full sequence live: bootstrap an anonymous session → GET /api/checkout/pub/orderForm (auto-creates an orderForm, sets checkout.vtex.com/CheckoutOrderFormOwnership cookies) → add a real SKU via the public addToCartLink → call estimateShipping with a postal-code + geo-coordinates address. The mutation executed successfully (200, valid OrderForm shape back) in both the empty-cart and one-item-in-cart cases, but pickupOptions and deliveryOptions came back [] both times.

We did not yet try setting regionId on the session first (via the updateSession mutation, vtex.session-client, seen in the very first pasted cURL dump) before calling estimateShipping — the real front-end always does regions → updateSession (regionId) → estimateShipping, in that order, and we skipped the middle step. That's the next thing to try if this gets picked back up; it's plausible VTEX won't compute pickup logistics for a session with no regionId set on its segment, regardless of what's in the addressInput.

Side effect disclosure: reproducing this created several real (harmless) anonymous carts on Walmart GT's production system, each with one unit of "Dosificador Evenflo De Leche" — no payment info was ever attached, nothing was purchased, and anonymous abandoned carts expire on their own. Flagging it for transparency since this is a live production system, not a sandbox.
3c. CONFIRMED: the real per-store mechanism (this replaces the "not achievable" conclusion in section 2)
Picking up exactly where 3b stalled: we tried setting regionId via updateSession before estimateShipping, and it still came back with empty pickupOptions/deliveryOptions. The GraphQL Shipping.pickupOptions/deliveryOptions fields turned out to be a dead end regardless of ordering — empirically, they just don't populate on this account, full stop. The real per-store logistics data lives somewhere else: the plain REST orderForm's shippingData.logisticsInfo[].slas. This is standard VTEX (pre-dates the GraphQL layer), we just hadn't looked at it directly.
The validated end-to-end sequence
1. PATCH /api/sessions {}                                    → issues vtex_session + vtex_segment cookies

2. GET   /api/checkout/pub/orderForm                          → creates/fetches the cart, gives orderFormId

3. GET   /api/checkout/pub/regions?country=GTM&sc=1

         &postalCode={cp}                                     → sellers covering this postal code + a regionId

4. POST  /_v/private/graphql/v1  operationName=updateSession

         sender vtex.session-client@1.x

         hash 4e3ac18d87b47c22247f13db63a3cd4c46ca05f15017651abf956de5db9ec882

         variables: {fields:{regionId, country, postalCode,

                     geoCoordinates:"{lng}, {lat}"}}            → binds the region to this session

5. GET   /checkout/cart/add?sku={sku}&qty={n}&seller=1

         &sc=1&price={cents}&cv=_                              → adds the SKU (from commertialOffer.addToCartLink)

6. POST  /_v/private/graphql/v1  operationName=UpdateSelectedAddress

         sender vtex.checkout-resources@0.50.1

         hash df64ce690840c56d27634714a547181f9369aec98d472bd3da775f1a36c433f6

         variables: {address:{addressType:"residential", city, country:"GTM",

                     state, postalCode, neighborhood, geoCoordinates:[lng,lat]}}

                                                                 → THIS is the step that actually triggers

                                                                   VTEX to compute real logistics for the cart

7. GET   /api/checkout/pub/orderForm/{orderFormId}              → shippingData.logisticsInfo[itemIndex].slas

                                                                   now contains the real, store-specific answer

Step 6 is the one we were missing in 3b — estimateShipping/updateSession alone only bind the region, they don't attach an address to the specific cart. UpdateSelectedAddress is what actually persists shippingData.address on the orderForm and triggers the SLA (shipping/pickup) computation for every line item.
What comes back — real, per-item, per-location data
"logisticsInfo": [{

  "itemIndex": 0,

  "selectedSla": "Entrega a domicilio",

  "selectedDeliveryChannel": "delivery",

  "slas": [{

    "id": "Recoger en Tienda (W459)",

    "deliveryChannel": "pickup-in-point",

    "name": "Recoger en Tienda (W459)",

    "deliveryIds": [{

      "warehouseId": "W459",

      "courierName": "Recoger en Tienda - BOSQ SAN NICOLAS"

    }],

    "shippingEstimate": "0d",

    "availableDeliveryWindows": [

      {"startDateUtc": "2026-07-03T11:00:00+00:00", "endDateUtc": "2026-07-03T12:00:59+00:00", "price": 0}

      /* ... more slots ... */

    ]

  }]

}]

deliveryIds[0].courierName carries the real store name. warehouseId is VTEX's internal store code. availableDeliveryWindows are real pickup time slots. There's also always a delivery (home-delivery) SLA alongside pickup-in-point.
Verified this genuinely varies by location, not a fixed default
Postal code tested
Sellers reported by regions
Pickup SLA returned
105704 (Mixco, Zona 4)
Andreiso store, WM-BOSQ SAN NICOLAS, WM - NARANJO
W459 → "Recoger en Tienda - BOSQ SAN NICOLAS"
01001 (Guatemala, Zona 1)
Andreiso store, WM-DEL NORTE
(none — this run's coarse city/neighborhood strings likely didn't resolve cleanly; worth retrying with tighter address data before concluding this store has no pickup)
01010 (Guatemala, Zona 10)
Andreiso store, WM-PROCERES
W4370 → "Recoger en Tienda - PROCERES"


Two of three test locations returned the correct, distinct, real physical store for that address. This confirms the mechanism is genuinely location-aware and not a hardcoded default — good enough to build on, with the caveat that address-field precision (city/neighborhood strings, not just postal code) may matter and deserves a bit more testing before relying on it for every Guatemalan postal code.
The unavoidable catch: checking availability is a cart mutation
There is no lighter-weight, read-only "is this SKU available for pickup near postal code X" endpoint. The only way to get a real answer is steps 1–7 above, and step 5 adds a real item to a real cart as a side effect of merely checking. There's no way to "peek" at store-level logistics without that. This matters for MCP design: a tool like check_store_availability(sku, postal_code) is not read-only under the hood, even though from the agent's perspective it feels like a lookup — it will leave behind real (if harmless, if abandoned-and-expiring) cart state on Walmart's production servers every time it's called. Worth being upfront about this to whoever approves the MCP's tool list.
3d. Concrete MCP architecture given all of the above
Architectural shift required: everything in section 1 (search/browse/facets) is stateless — one HTTP call in, one JSON out, no cookies needed. Store-aware availability is fundamentally stateful: it needs a persistent cookie jar (vtex_session, vtex_segment, checkout.vtex.com, CheckoutOrderFormOwnership) carried across several tool calls tied to one conversation/session. The current FastMCP server (Script B) uses a fresh httpx.AsyncClient per call with no cookie persistence — that's correct for search, but won't work for this without change.

Proposed tool set, split by statefulness:

Stateless (unchanged from Script B): search_products, browse_category, count_products, get_product_by_slug/id, list_categories, list_brands, get_facets, autocomplete, find_stores_near_postal_code (section 3, Phase 1).

Stateful (new, share one httpx.AsyncClient(cookies=...) per MCP session):

set_location(postal_code, lat, lng) — runs steps 1–4 above once per conversation. Returns the list of sellers/stores covering that postal code (from regions) so the agent/user can see coverage immediately, without needing to add anything to a cart yet.
check_availability(sku, seller="1", price_cents) — runs steps 5–7. Returns the parsed slas: which stores offer pickup (name + warehouseId + time windows) and whether home delivery is available, for the currently set location. Must clearly document that this mutates a real cart as a side effect (see 3c).
view_cart() — plain GET orderForm using the session's stored orderFormId.
(add_to_cart / full checkout — intentionally excluded from the default set; see section 4's risk assessment, which still applies unchanged.)

Session lifecycle: one orderFormId + cookie jar per MCP client session (not global, not per-call) — otherwise concurrent users would trample each other's cart/region state. If the MCP framework's session model doesn't map cleanly to "one cookie jar per conversation," that's a blocking design question to resolve before implementing set_location/check_availability, not an afterthought.
4. Bonus reconnaissance: cart & checkout
While testing store-selection, the user also captured the network traffic for "add to cart," opening the cart sidebar, and clicking through to /checkout/. Documenting it here because it's directly relevant to how far this MCP could go, even though we're not recommending building it yet.

Action
Mechanism
Notes
Add a SKU to the cart
GET /checkout/cart/add?sku={id}&qty={n}&seller={id}&sc=1&price={cents}&cv=_&sc=1
Plain public REST GET. This link is already present in every commertialOffer.addToCartLink field returned by product search — no GraphQL, no persisted-query hash. Simplest possible mutation in the whole API surface.
Change quantity of an item already in the cart
POST /_v/private/graphql/v1, operation updateItems, persisted query e202bb0a918da7748421a2d2eae48a4a05aad7251fee3a1f868426f2d4ef4fc6, sender vtex.checkout-resources@0.x
Private endpoint. Requires the cart line's uniqueId (obtained from the orderForm state), not the SKU id. Same hash-rotation risk as the GraphQL search queries.
View current cart state
GET /api/checkout/pub/orderForm/{orderFormId}
Public-ish (needs the orderFormId, which VTEX issues via a cookie on first cart interaction). Returns full cart contents, items, totals.
Refresh SKU variation info
GET /api/catalog_system/pub/products/variations/{productId}
Fired repeatedly on every quantity change in the UI; looks like a display refresh, not a required step for the mutation itself.
Load /checkout/ page
Plain page navigation
Just the checkout SPA shell + ~40 static CSS/JS assets from io2.vtex.com. No API of interest here — the real checkout logic happens via further GraphQL calls (estimateShipping, payment, etc.) once the page boots, which we have not captured.


Assessment: cart/checkout is a fundamentally different risk tier than everything documented in sections 1–3. Search, browse, facets, and store-lookup are read-only — safe defaults for an agent. addToCartLink and updateItems mutate a real orderForm belonging to a real (anonymous) session, and that orderForm is one estimateShipping + payment step away from placing an actual order. Recommendation: do not fold cart/checkout into the default MCP tool set. If it's ever wanted, it should be a separate, explicitly opt-in toolset (e.g. add_to_cart, view_cart) with the write path clearly isolated from the read-only browsing tools, so an agent can't stumble into it by accident.
5. Open items / next steps
Decide Phase 1 vs Phase 2 scope — Phase 2 confirmed technically feasible (section 3c). Remaining decision is whether to build it now vs. defer, given the stateful-session architecture change it requires (section 3d).
Prototype the orderForm → estimateShipping chain — done; the working chain uses UpdateSelectedAddress, not estimateShipping (section 3c).
Retest the 01001 (Zona 1) case with a more precise city/neighborhood/street in the address input — unclear yet whether the empty pickup SLA there means "this store has no pickup" or "our synthetic address didn't resolve." Don't generalize from one ambiguous data point.
Resolve the session-lifecycle question from 3d: does the MCP framework in use support one persistent cookie-jar/httpx.AsyncClient per conversation/session, as opposed to Script B's current per-call stateless client? This blocks implementing set_location/check_availability.
Decide product-level scope: is check_availability's side effect (real cart mutation on every "just checking" call, section 3c) acceptable? If not, this is a hard blocker for Phase 2 as currently understood — no read-only alternative was found.
If keeping any GraphQL persisted-query tool (autocomplete/suggestions/checkout mutations), add a runtime guard that surfaces PersistedQueryNotFoundError as a clear "hash expired, needs refresh" error rather than a generic failure. The bundle-extraction technique in 3b is the fastest way to refresh a dead hash going forward.
Housekeeping: real browser session/cURL exports were pasted into chat multiple times during this investigation, including live vtex_session JWTs and vtex_segment cookies. Anonymous storefront sessions (no PII/auth risk observed), but avoid pasting raw cookies going forward — a sanitized request (URL + non-sensitive headers) is enough for this kind of debugging.
Housekeeping: this investigation left several real (harmless, self-expiring) anonymous carts on Walmart GT's production system. No action needed, just noting it's a live system that was touched, not a sandbox.

