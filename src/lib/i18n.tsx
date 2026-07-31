import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PRODUCT_NAME } from "./product-name";

export type Locale = "es" | "en";

const STORAGE_KEY = "walmart-mcp:locale";

/* ─────────────────── dictionaries ─────────────────── */

type Dict = Record<string, string>;

const es: Dict = {
  // topbar
  "topbar.subtitle": "asistente de compras · MCP en vivo",
  "topbar.status": "MCP live · 9 tools",
  "topbar.cart": "Carrito",
  "topbar.user_initials": "JM",
  "topbar.delivery.label": "Entrega",
  "topbar.delivery.location": "Guatemala",
  "topbar.search.placeholder": "Buscá un producto o preguntale a {name}…",
  "topbar.search.submit": "Buscar",
  "topbar.account.label": "Cuenta",
  "topbar.account.sub": "Preferencias",
  "topbar.lists.label": "Productos",
  "topbar.lists.sub": "Mis ítems",
  "chat.new": "Nueva conversación",
  "chat.delete": "Eliminar chat",
  "chat.delete_confirm":
    "¿Eliminar esta conversación? No se puede deshacer.",

  // delivery popover
  "delivery.popover.title": "Compra y entrega",
  "delivery.popover.option1": "Envío",
  "delivery.popover.option2": "Recogida",
  "delivery.popover.option3": "Domicilio",
  "delivery.popover.body":
    "Tu canasta se exportará a walmart.com.gt para completar la compra.",
  "delivery.popover.cta": "Abrir carrito",

  // sub-navbar
  "subnav.aria_label": "Navegación de categorías",
  "subnav.departamentos": "Departamentos",
  "subnav.departamentos.prompt": "mostrame los departamentos disponibles",
  "subnav.categorias": "Categorías",
  "subnav.ofertas": "Ofertas",
  "subnav.ofertas.prompt": "mostrame las mejores ofertas y rollbacks",
  "subnav.recetas": "Recetas",
  "subnav.recetas.prompt": "dame ideas de recetas con ingredientes del catálogo",
  "subnav.entrega": "Envío y recogida",
  "subnav.entrega.prompt": "¿cómo funciona el envío y la recogida? ¿cómo completo mi pedido?",
  "subnav.farmacia": "Farmacia",
  "subnav.farmacia.prompt": "productos de farmacia",
  "subnav.nuevos": "Nuevos",
  "subnav.nuevos.prompt": "productos recién llegados",
  "subnav.limpieza": "Limpieza",
  "subnav.limpieza.prompt": "muéstrame la sección de limpieza",
  "subnav.bebes": "Bebés",
  "subnav.bebes.prompt": "productos esenciales para bebés",
  "subnav.comidas": "Comidas fáciles",
  "subnav.comidas.prompt": "ideas de comidas rápidas y fáciles",
  "subnav.mis_items": "Mis ítems",
  "subnav.solo_gt": "Solo en Walmart",
  "subnav.solo_gt.prompt":
    "mostrame productos de las marcas exclusivas de Walmart: Great Value, Parent's Choice, Equate, Mainstays y Athletic Works",
  "subnav.tarjeta": "Pagos",
  "subnav.tarjeta.prompt":
    "¿cómo funciona el proceso de pago? ¿dónde pago mi pedido?",

  // mega-menu
  "mega.see_all": "Ver todo en",
  "mega.search_all": "buscar productos en {category}",
  "mega.search_sub": "buscar productos en {category}",
  "mega.no_subs": "Esta categoría no tiene subcategorías.",

  // hero
  "hero.greeting_prefix": "Hola, soy",
  "hero.greeting_name": "{name}",
  "hero.subtitle":
    "Tu asistente para Canasta GT. Pregunta por cualquier producto en lenguaje natural — yo busco, comparo y te recomiendo.",
  "hero.subtitle_mcp": "9 herramientas MCP conectadas en vivo.",
  "hero.chip.pizza": "quiero hacer una pizza casera",
  "hero.chip.caldo": "ingredientes para un caldo de pollo",
  "hero.chip.party": "snacks para una fiesta de 10 personas",
  "hero.chip.baby": "todo lo esencial para un bebé recién nacido",
  "hero.stats.tools": "herramientas MCP",
  "hero.stats.categories": "categorías",
  "hero.stats.live": "Catálogo en vivo",

  // hero banner CTA
  "hero.banner.title": "Conocé a {name}, tu asistente con IA",
  "hero.banner.cta": "Solo para Walmart Guatemala · ¡empezá a chatear hoy!",

  // hero video
  "hero.video.title": "Video de demostración de {name}",
  "hero.video.fallback": "Video no disponible",

  // hero FAQ
  "hero.faq.heading": "Preguntas frecuentes",
  "hero.faq.q1": "¿Qué es {name}?",
  "hero.faq.a1":
    "{name} es un asistente de IA que conecta con el catálogo en vivo de Walmart Guatemala (walmart.com.gt). Pregúntale por una receta, electrónica, productos del hogar o lo que sea — busca, compara y te recomienda picks concretos con su precio actual.",
  "hero.faq.q2": "¿Cómo funciona?",
  "hero.faq.a2":
    "{name} entiende lo que necesitás en lenguaje natural y consulta el catálogo de walmart.com.gt en vivo para encontrarlo. No hay copia cacheada — cada búsqueda corre contra el catálogo real en tiempo real, así que los precios y disponibilidad que ves son los actuales.",
  "hero.faq.q3": "¿Dónde está disponible?",
  "hero.faq.a3":
    "{name} solo está disponible para Guatemala. El catálogo y los precios provienen de walmart.com.gt; al finalizar tu canasta, te redirigimos al sitio oficial de Walmart Guatemala para completar el pago.",
  "hero.faq.q4": "¿Qué datos usa?",
  "hero.faq.a4":
    "Tus preferencias (presupuesto, restricciones dietarias, marcas favoritas) se guardan en tu navegador. Tus mensajes se envían al modelo para responderte; no los guardamos del lado servidor.",
  "hero.faq.q5": "¿Cómo doy feedback?",
  "hero.faq.a5":
    "Toda la conversación queda en tu sesión. Para reportar problemas o sugerencias, contactá al equipo directamente.",

  // composer
  "composer.placeholder": "Pregunta por cualquier producto…",
  "composer.send": "Enviar",
  "composer.cancel": "Cancelar",
  "composer.status": "MCP live · 9 tools",

  // result block
  "result.results": "{n} resultados",
  "result.in_sections": "en {n} secciones",
  "result.for_query": "para \"{q}\"",
  "result.omitted_no_price": "{n} sin precio omitidos",
  "result.tab.products": "Productos",
  "result.tab.compare": "Comparar",
  "result.tab.detail": "Detalle",
  "result.section.results": "{n} resultados",
  "result.plan_label": "Plan de compra",
  "result.recommended": "Recomendado:",
  "result.why.shelf_correct": "Más barato en estantería correcta · {price}",
  "result.why.shelf_dominant": "Más barato en categoría dominante · {price}",
  "result.why.cat_match": "Más barato con categoría coincidente · {price}",
  "result.why.name_match": "Más barato con nombre coincidente · {price}",
  "result.why.fallback": "Más barato disponible · {price}",
  "result.low_confidence.title":
    "Estos resultados no parecen coincidir con tu búsqueda",
  "result.low_confidence.body":
    "Walmart Guatemala puede no tener este producto en su catálogo en línea. Lo que ves abajo son los items más cercanos.",
  "result.safe.mismatch_for_query":
    "No encontramos productos que coincidan exactamente con \"{q}\" en el catálogo en línea de Walmart Guatemala. Lo que ves abajo son los ítems más cercanos que devolvió el catálogo — pueden no ser lo que buscas.",
  "result.safe.mismatch_generic":
    "No encontramos productos que coincidan exactamente con tu búsqueda en el catálogo en línea de Walmart Guatemala. Lo que ves abajo son los ítems más cercanos.",
  "result.safe.empty_for_query":
    "Walmart Guatemala no tiene resultados para \"{q}\" en su catálogo en línea. Probá ajustar la consulta o usar uno de los chips de abajo.",
  "result.safe.empty_generic":
    "Walmart Guatemala no tiene resultados para esta búsqueda en su catálogo en línea. Probá ajustar la consulta o usar uno de los chips de abajo.",
  "result.empty.title": "No encontramos productos",
  "result.empty.body":
    "Walmart Guatemala no tiene resultados para esta búsqueda. Probá ajustar la consulta o usar uno de los chips de abajo.",
  "substitution.diet":
    "Adaptado a tus preferencias · cambiamos {original} por {chosen}",
  "substitution.brand":
    "Personalizado según tus preferencias · {chosen}",



  "result.showing_count": "Mostrando {shown} de {total} productos",
  "result.load_more": "Cargar más",
  "result.loading_more": "Cargando…",

  "result.followups.label": "¿Quieres que…?",
  "result.followups.sort_price": "Ordenar por precio ↑",
  "result.followups.only_brand": "Solo {brand}",
  "result.followups.under_price": "Bajo {price}",
  "result.followups.compare_top3": "Comparar top 3",
  "result.followups.find_similar": "Encontrar similar",
  "result.followups.compare_other_brand": "Comparar con otra marca",
  "result.followups.view_category": "Ver {category}",

  // product card
  "card.add": "+ Agregar",
  "card.details": "Detalles",
  "card.compare": "+ Comparar",
  "card.comparing": "✓ Comparando",
  "card.tag.cheapest": "Más barato",
  "card.tag.discount": "-{pct}%",
  "card.aria.detail": "Ver detalles de {name}",
  "card.aria.pin_add": "Agregar a comparación",
  "card.aria.pin_remove": "Quitar de comparación",
  "card.no_sku": "Producto sin SKU disponible",

  // detail pane
  "detail.view_walmart": "Ver ficha completa en walmart.com.gt →",
  "detail.back": "← Volver a productos",
  "detail.in_stock": "En catálogo",
  "detail.in_cart": "en tu carrito",
  "detail.add_to_cart": "+ Agregar al carrito",
  "detail.in_comparison": "✓ En comparación",
  "detail.compare_btn": "+ Comparar",
  "detail.live_disclaimer":
    "ⓘ Datos en vivo del catálogo Walmart Guatemala vía MCP. Verifica precio y disponibilidad antes de comprar.",
  "detail.image_aria": "Imagen {n}",
  "detail.disclaimer": "{name} puede equivocarse. Verifica precios y disponibilidad antes de comprar.",

  // compare table
  "compare.empty": "Marca productos con + Comparar para verlos aquí.",
  "compare.heading_one": "Comparando {n} producto",
  "compare.heading_many": "Comparando {n} productos",
  "compare.hint": "Pulsa × para descartar",
  "compare.col.brand": "Marca",
  "compare.col.price": "Precio",
  "compare.cheapest_badge": "Más barato",
  "compare.remove": "Quitar",
  "compare.recommend_lead": "Recomendación de {name}:",
  "compare.recommend_tail": "es la mejor relación precio/cantidad.",
  "compare.see_walmart": "Ver en Walmart {price}",
  "compare.add_more": "Agregá más para comparar",

  // cart
  "cart.title": "Tu carrito",
  "cart.subtitle_one": "{n} producto",
  "cart.subtitle_many": "{n} productos",
  "cart.empty.title": "Carrito vacío",
  "cart.empty.body": "Agrega productos desde las recomendaciones de {name}.",
  "cart.empty.cta": "Cerrar y explorar",
  "cart.subtotal": "Subtotal",
  "cart.checkout": "Abrir en Walmart →",
  "cart.checkout.hint": "Te redirigimos a walmart.com.gt para finalizar.",
  "cart.clear": "Vaciar carrito",
  "cart.button.aria": "Abrir carrito",
  "cart.button.aria_count_one": "Abrir carrito, {n} producto",
  "cart.button.aria_count_many": "Abrir carrito, {n} productos",
  "cart.close.aria": "Cerrar carrito",
  "cart.popover.title": "¡Tu primer producto!",
  "cart.popover.body": "Toca el carrito para ver lo que llevas.",
  "cart.popover.close": "Cerrar aviso",
  "cart.line.remove": "Quitar",

  // footer
  "footer.disclaimer":
    "{name} puede equivocarse. Verifica precios y disponibilidad antes de comprar.",

  // loading
  "loading.searching_prefix": "Buscando",
  "loading.searching_suffix": "en el catálogo…",
  "loading.working": "{name} está trabajando en tu pedido…",
  "loading.thinking": "{name} está pensando…",
  "loading.processing": "{name} está procesando…",
  "loading.step_error": "error",

  // qty stepper
  "qty.decrement": "Disminuir cantidad",
  "qty.increment": "Aumentar cantidad",

  // preferences
  "prefs.title": "Preferencias",
  "prefs.subtitle": "{name} usará estas reglas para personalizar tu canasta",
  "prefs.gear.aria": "Abrir preferencias",
  "prefs.close.aria": "Cerrar preferencias",
  "prefs.budget.label": "Presupuesto total",
  "prefs.budget.placeholder": "Sin límite",
  "prefs.budget.clear": "Quitar",
  "prefs.budget.current": "Presupuesto actual: {amount}",
  "prefs.household.label": "Tamaño del hogar",
  "prefs.household.unit_one": "persona",
  "prefs.household.unit_many": "personas",
  "prefs.diet.label": "Restricciones alimentarias",
  "prefs.diet.vegetarian": "Vegetariano",
  "prefs.diet.vegan": "Vegano",
  "prefs.diet.gluten-free": "Sin gluten",
  "prefs.diet.lactose-free": "Sin lactosa",
  "prefs.diet.no-pork": "Sin cerdo",
  "prefs.diet.keto": "Keto",
  "prefs.brands.label": "Marcas preferidas",
  "prefs.brands.hint":
    "{name} favorecerá estas marcas cuando estén disponibles",
  "prefs.reset": "Restablecer",
  "prefs.done": "Listo",

  // errors
  "error.network.title": "No pude alcanzar el catálogo",
  "error.network.body":
    "Hubo un problema de red al conectar con Walmart Guatemala. Probá de nuevo en un momento.",
  "error.auth.title": "Problema de autenticación",
  "error.auth.body":
    "Las credenciales del catálogo no son válidas. Si esto persiste, contactá al equipo.",
  "error.config.title": "Servidor mal configurado",
  "error.config.body":
    "Faltan variables de entorno en el servidor. Si esto persiste, contactá al equipo.",
  "error.unknown.title": "Algo salió mal",
  "error.unknown.body":
    "Ocurrió un error inesperado. Probá enviar el mensaje de nuevo.",
  "error.dismiss": "Cerrar",

  // per-turn error tile (shown inline when an assistant turn fails)
  "turn.error.title": "Esta respuesta falló",
  "turn.error.body": "La conexión se interrumpió antes de terminar. Podés reintentarla.",
  "turn.error.retry": "Reintentar",
  "turn.render_error.title": "No pude mostrar este resultado",
  "turn.render_error.body": "La respuesta del catálogo tenía un formato inesperado. Probá enviar de nuevo el mensaje.",

  // skip link
  "a11y.skip_to_content": "Saltar al contenido",
  "a11y.app_title": "{name} · Asistente de compras Walmart Guatemala",
  "a11y.lang_label": "Idioma",

  // confirm dialog
  "confirm.cancel": "Cancelar",
  "confirm.delete_chat.title": "¿Eliminar esta conversación?",
  "confirm.delete_chat.body": "Se borrará permanentemente. No se puede deshacer.",
  "confirm.delete_chat.confirm": "Eliminar",
};

const en: Dict = {
  "topbar.subtitle": "shopping assistant · MCP live",
  "topbar.status": "MCP live · 9 tools",
  "topbar.cart": "Cart",
  "topbar.user_initials": "JM",
  "topbar.delivery.label": "Delivery",
  "topbar.delivery.location": "Guatemala",
  "topbar.search.placeholder": "Search products or ask {name}…",
  "topbar.search.submit": "Search",
  "topbar.account.label": "Account",
  "topbar.account.sub": "Preferences",
  "topbar.lists.label": "Items",
  "topbar.lists.sub": "My picks",
  "chat.new": "New conversation",
  "chat.delete": "Delete chat",
  "chat.delete_confirm":
    "Delete this conversation? This can't be undone.",

  // delivery popover
  "delivery.popover.title": "Shopping & delivery",
  "delivery.popover.option1": "Shipping",
  "delivery.popover.option2": "Pickup",
  "delivery.popover.option3": "Home delivery",
  "delivery.popover.body":
    "Your basket will export to walmart.com.gt to complete checkout.",
  "delivery.popover.cta": "Open cart",

  // sub-navbar
  "subnav.aria_label": "Category navigation",
  "subnav.departamentos": "Departments",
  "subnav.departamentos.prompt": "show me the available departments",
  "subnav.categorias": "Categories",
  "subnav.ofertas": "Deals",
  "subnav.ofertas.prompt": "show me the best deals and rollbacks",
  "subnav.recetas": "Recipes",
  "subnav.recetas.prompt": "give me recipe ideas with catalog ingredients",
  "subnav.entrega": "Shipping & pickup",
  "subnav.entrega.prompt": "how does shipping and pickup work? how do I complete my order?",
  "subnav.farmacia": "Pharmacy",
  "subnav.farmacia.prompt": "pharmacy products",
  "subnav.nuevos": "New",
  "subnav.nuevos.prompt": "newly arrived products",
  "subnav.limpieza": "Cleaning",
  "subnav.limpieza.prompt": "show me the cleaning section",
  "subnav.bebes": "Baby",
  "subnav.bebes.prompt": "baby essentials",
  "subnav.comidas": "Easy meals",
  "subnav.comidas.prompt": "quick and easy meal ideas",
  "subnav.mis_items": "My items",
  "subnav.solo_gt": "Only at Walmart",
  "subnav.solo_gt.prompt":
    "show me products from Walmart's exclusive brands: Great Value, Parent's Choice, Equate, Mainstays and Athletic Works",
  "subnav.tarjeta": "Payments",
  "subnav.tarjeta.prompt":
    "how does the payment process work? where do I pay for my order?",

  // mega-menu
  "mega.see_all": "See all in",
  "mega.search_all": "search products in {category}",
  "mega.search_sub": "search products in {category}",
  "mega.no_subs": "This category has no subcategories.",

  // hero
  "hero.greeting_prefix": "Hi, I'm",
  "hero.greeting_name": "{name}",
  "hero.subtitle":
    "Your assistant for Canasta GT. Ask about any product in natural language — I search, compare, and recommend.",
  "hero.subtitle_mcp": "9 MCP tools connected live.",
  "hero.chip.pizza": "I want to make a homemade pizza",
  "hero.chip.caldo": "ingredients for a chicken soup",
  "hero.chip.party": "snacks for a party of 10 people",
  "hero.chip.baby": "everything essential for a newborn baby",
  "hero.stats.tools": "MCP tools",
  "hero.stats.categories": "categories",
  "hero.stats.live": "Live catalog",

  // hero banner CTA
  "hero.banner.title": "Meet {name}, your AI assistant",
  "hero.banner.cta": "Only for Walmart Guatemala — start chatting today!",

  // hero video
  "hero.video.title": "{name} demo video",
  "hero.video.fallback": "Video unavailable",

  // hero FAQ
  "hero.faq.heading": "Frequently asked questions",
  "hero.faq.q1": "What is {name}?",
  "hero.faq.a1":
    "{name} is an AI assistant connected live to the Walmart Guatemala catalog (walmart.com.gt). Ask about recipes, electronics, household items, anything — it searches, compares, and recommends concrete picks with current pricing.",
  "hero.faq.q2": "How does it work?",
  "hero.faq.a2":
    "{name} understands what you need in natural language and queries walmart.com.gt's live catalog to find it. There's no cached copy — every search runs against the real catalog in real time, so the prices and availability you see are current.",
  "hero.faq.q3": "Where is it available?",
  "hero.faq.a3":
    "{name} is only available for Guatemala. The catalog and pricing come from walmart.com.gt; when you finalize your basket we redirect you to the official Walmart Guatemala site to complete checkout.",
  "hero.faq.q4": "What data does it use?",
  "hero.faq.a4":
    "Your preferences (budget, dietary restrictions, favorite brands) are stored in your browser. Messages are sent to the model to respond; we don't store them server-side.",
  "hero.faq.q5": "How do I give feedback?",
  "hero.faq.a5":
    "Conversations stay within your session. To report issues or send suggestions, reach out to the team directly.",

  "composer.placeholder": "Ask about any product…",
  "composer.send": "Send",
  "composer.cancel": "Cancel",
  "composer.status": "MCP live · 9 tools",

  "result.results": "{n} results",
  "result.in_sections": "in {n} sections",
  "result.for_query": "for \"{q}\"",
  "result.omitted_no_price": "{n} without price omitted",
  "result.tab.products": "Products",
  "result.tab.compare": "Compare",
  "result.tab.detail": "Detail",
  "result.section.results": "{n} results",
  "result.plan_label": "Shopping plan",
  "result.recommended": "Recommended:",
  "result.why.shelf_correct": "Cheapest on the right shelf · {price}",
  "result.why.shelf_dominant": "Cheapest on the dominant shelf · {price}",
  "result.why.cat_match": "Cheapest with matching category · {price}",
  "result.why.name_match": "Cheapest with matching name · {price}",
  "result.why.fallback": "Cheapest available · {price}",
  "result.low_confidence.title":
    "These results don't seem to match your search",
  "result.low_confidence.body":
    "Walmart Guatemala may not carry this product in their online catalog. What you see below are the closest items.",
  "result.safe.mismatch_for_query":
    "We couldn't find products that exactly match \"{q}\" in Walmart Guatemala's online catalog. What you see below are the closest items the catalog returned — they may not be what you're looking for.",
  "result.safe.mismatch_generic":
    "We couldn't find products that exactly match your search in Walmart Guatemala's online catalog. What you see below are the closest items.",
  "result.safe.empty_for_query":
    "Walmart Guatemala has no results for \"{q}\" in their online catalog. Try adjusting your query or use one of the chips below.",
  "result.safe.empty_generic":
    "Walmart Guatemala has no results for this search in their online catalog. Try adjusting your query or use one of the chips below.",
  "result.empty.title": "No products found",
  "result.empty.body":
    "Walmart Guatemala has no results for this search. Try adjusting your query or use one of the chips below.",
  "substitution.diet":
    "Tailored to your preferences · swapped {original} for {chosen}",
  "substitution.brand":
    "Personalized to your preferences · {chosen}",

  "result.showing_count": "Showing {shown} of {total} products",
  "result.load_more": "Load more",
  "result.loading_more": "Loading…",

  "result.followups.label": "Want to…?",
  "result.followups.sort_price": "Sort by price ↑",
  "result.followups.only_brand": "Only {brand}",
  "result.followups.under_price": "Under {price}",
  "result.followups.compare_top3": "Compare top 3",
  "result.followups.find_similar": "Find similar",
  "result.followups.compare_other_brand": "Compare with another brand",
  "result.followups.view_category": "View {category}",

  "card.add": "+ Add",
  "card.details": "Details",
  "card.compare": "+ Compare",
  "card.comparing": "✓ Comparing",
  "card.tag.cheapest": "Cheapest",
  "card.tag.discount": "-{pct}%",
  "card.aria.detail": "See details for {name}",
  "card.aria.pin_add": "Add to comparison",
  "card.aria.pin_remove": "Remove from comparison",
  "card.no_sku": "Product has no available SKU",

  "detail.view_walmart": "View full listing on walmart.com.gt →",
  "detail.back": "← Back to products",
  "detail.in_stock": "In catalog",
  "detail.in_cart": "in your cart",
  "detail.add_to_cart": "+ Add to cart",
  "detail.in_comparison": "✓ In comparison",
  "detail.compare_btn": "+ Compare",
  "detail.live_disclaimer":
    "ⓘ Live data from the Walmart Guatemala catalog via MCP. Verify price and availability before buying.",
  "detail.image_aria": "Image {n}",
  "detail.disclaimer": "{name} can make mistakes. Verify price and availability before buying.",

  "compare.empty": "Mark products with + Compare to see them here.",
  "compare.heading_one": "Comparing {n} product",
  "compare.heading_many": "Comparing {n} products",
  "compare.hint": "Click × to dismiss",
  "compare.col.brand": "Brand",
  "compare.col.price": "Price",
  "compare.cheapest_badge": "Cheapest",
  "compare.remove": "Remove",
  "compare.recommend_lead": "{name}'s pick:",
  "compare.recommend_tail": "has the best price/value.",
  "compare.see_walmart": "See on Walmart {price}",
  "compare.add_more": "Add more to compare",

  "cart.title": "Your cart",
  "cart.subtitle_one": "{n} item",
  "cart.subtitle_many": "{n} items",
  "cart.empty.title": "Empty cart",
  "cart.empty.body": "Add products from {name}'s recommendations.",
  "cart.empty.cta": "Close and browse",
  "cart.subtotal": "Subtotal",
  "cart.checkout": "Open in Walmart →",
  "cart.checkout.hint": "We'll redirect you to walmart.com.gt to finish.",
  "cart.clear": "Clear cart",
  "cart.button.aria": "Open cart",
  "cart.button.aria_count_one": "Open cart, {n} item",
  "cart.button.aria_count_many": "Open cart, {n} items",
  "cart.close.aria": "Close cart",
  "cart.popover.title": "Your first item!",
  "cart.popover.body": "Tap the cart to see what's inside.",
  "cart.popover.close": "Dismiss",
  "cart.line.remove": "Remove",

  "footer.disclaimer":
    "{name} can make mistakes. Verify price and availability before buying.",

  "loading.searching_prefix": "Searching",
  "loading.searching_suffix": "in the catalog…",
  "loading.working": "{name} is working on your request…",
  "loading.thinking": "{name} is thinking…",
  "loading.processing": "{name} is processing…",
  "loading.step_error": "error",

  // qty stepper
  "qty.decrement": "Decrease quantity",
  "qty.increment": "Increase quantity",

  // preferences
  "prefs.title": "Preferences",
  "prefs.subtitle": "{name} will use these rules to personalize your basket",
  "prefs.gear.aria": "Open preferences",
  "prefs.close.aria": "Close preferences",
  "prefs.budget.label": "Total budget",
  "prefs.budget.placeholder": "No limit",
  "prefs.budget.clear": "Clear",
  "prefs.budget.current": "Current budget: {amount}",
  "prefs.household.label": "Household size",
  "prefs.household.unit_one": "person",
  "prefs.household.unit_many": "people",
  "prefs.diet.label": "Dietary restrictions",
  "prefs.diet.vegetarian": "Vegetarian",
  "prefs.diet.vegan": "Vegan",
  "prefs.diet.gluten-free": "Gluten-free",
  "prefs.diet.lactose-free": "Lactose-free",
  "prefs.diet.no-pork": "No pork",
  "prefs.diet.keto": "Keto",
  "prefs.brands.label": "Preferred brands",
  "prefs.brands.hint": "{name} will favor these brands when available",
  "prefs.reset": "Reset",
  "prefs.done": "Done",

  // errors
  "error.network.title": "Couldn't reach the catalog",
  "error.network.body":
    "There was a network problem connecting to Walmart Guatemala. Try again in a moment.",
  "error.auth.title": "Authentication issue",
  "error.auth.body":
    "The catalog credentials aren't valid. If this persists, contact the team.",
  "error.config.title": "Server misconfigured",
  "error.config.body":
    "Required environment variables are missing on the server. If this persists, contact the team.",
  "error.unknown.title": "Something went wrong",
  "error.unknown.body":
    "An unexpected error occurred. Try sending the message again.",
  "error.dismiss": "Dismiss",

  // per-turn error tile
  "turn.error.title": "This response failed",
  "turn.error.body": "The connection dropped before it finished. You can retry it.",
  "turn.error.retry": "Retry",
  "turn.render_error.title": "Couldn't show this result",
  "turn.render_error.body": "The catalog response was in an unexpected shape. Try sending the message again.",

  // skip link
  "a11y.skip_to_content": "Skip to content",
  "a11y.app_title": "{name} · Walmart Guatemala shopping assistant",
  "a11y.lang_label": "Language",

  // confirm dialog
  "confirm.cancel": "Cancel",
  "confirm.delete_chat.title": "Delete this conversation?",
  "confirm.delete_chat.body": "This will be removed permanently and can't be undone.",
  "confirm.delete_chat.confirm": "Delete",
};

const DICTS: Record<Locale, Dict> = { es, en };

/* ─────────────────── interpolation ─────────────────── */

function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in params ? String(params[k]) : `{${k}}`,
  );
}

/* ─────────────────── context ─────────────────── */

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Translate a key with optional `{name}` interpolations. Returns the
   *  key itself if not found (so missing strings show up obviously). */
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function detectInitial(): Locale {
  if (typeof window === "undefined") return "es";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "es" || stored === "en") return stored;
  } catch {}
  // Default to Spanish for first-time visitors — this is a Walmart
  // Guatemala demo. English-speaking users flip via the locale switcher;
  // the choice persists in localStorage.
  return "es";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitial());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
      document.documentElement.setAttribute("lang", locale);
    } catch {}
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = DICTS[locale];
      const raw = dict[key] ?? DICTS.es[key] ?? key;
      // Auto-inject `name` from the env-configured product name. Caller can
      // still override by passing { name: ... } explicitly.
      return format(raw, { name: PRODUCT_NAME, ...params });
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider");
  return ctx;
}
