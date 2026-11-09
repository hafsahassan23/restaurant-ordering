# API reference

Base URL: `http://<server>:5000/api`. All bodies are JSON. Staff endpoints need `Authorization: Bearer <token>` from `POST /auth/login`.

**Errors** always have the shape `{ "error": "message", "code": "CODE" }`:
`400 VALIDATION` (with `details: [{ field, message }]`), `401 NO_TOKEN / BAD_TOKEN / INVALID_CREDENTIALS`, `403 FORBIDDEN / NOT_YOUR_TABLE / TABLE_CLOSED`, `404 NOT_FOUND`, `409` business-rule conflicts (`INSUFFICIENT_STOCK`, `DISH_UNAVAILABLE`, `BAD_TRANSITION`, `BAD_STATE`, `PENDING_ORDERS`, `ITEMS_NOT_SERVED`, ...), `429 RATE_LIMIT`, `500 SERVER_ERROR`.

Roles: **M** manager · **C** cashier · **W** waiter · **K** kitchen · **Public** = no login (customer phone, identified by the table token).

## Auth
| Method | Path | Roles | Request | Response |
|---|---|---|---|---|
| POST | `/auth/login` | Public (30 tries / 15 min) | `{ username, password }` | `{ token, user: { id, full_name, username, role } }` |
| GET | `/auth/me` | any staff | – | `{ user }` |

## Customer (QR)
| Method | Path | Roles | Request | Response |
|---|---|---|---|---|
| GET | `/public/menu` | Public | – | `[{ id, name_so, name_en, dishes: [{ id, name_*, description_*, price, photo_url, prep_minutes, available, unavailable_reason, modifier_groups: [{ id, name_*, is_required, min_select, max_select, modifiers: [{ id, name_*, price_delta, available }] }] }] }]` |
| GET | `/public/table/:token` | Public | – | `{ number, area, is_closed }` (404 for an unknown or replaced token) |
| GET | `/public/table/:token/orders` | Public | – | open orders of the table (shared by every phone at it) |
| POST | `/public/orders` | Public (20 / min) | `{ tableToken, items: [{ dishId, quantity, notes?, modifierIds? }] }` | `201` order view, status `pending_confirmation` |

## Orders, kitchen and items
| Method | Path | Roles | Request | Response |
|---|---|---|---|---|
| GET | `/tables` | W C M | – | floor map: tables with `status`, `assigned_waiter_id`, `waiter_name` |
| GET | `/orders/pending` | W M | – | customer orders waiting for confirmation |
| POST | `/orders` | W M | `{ tableId, items }` | `201` order, confirmed at once (stock deducted) |
| POST | `/orders/:id/confirm` | W M | – | order view; sends it to the kitchen and deducts stock |
| POST | `/orders/:id/reject` | W M | `{ reason? }` | order view (items cancelled, nothing deducted) |
| POST | `/orders/:id/move` | W M | `{ toTableId }` | order view on the new table |
| GET | `/kitchen/orders` | K W M | – | open confirmed orders, oldest first |
| PATCH | `/items/:id/status` | K (cooking, ready) · W (served) · M | `{ status: "cooking" \| "ready" \| "served" }` | `{ itemId, orderId, tableId, tableNumber, status }` |
| POST | `/items/:id/cancel` | M | `{ reason }` (3–255 chars) | `{ itemId, status: "cancelled", waste, restored }` |

## Bills and payments
| Method | Path | Roles | Request | Response |
|---|---|---|---|---|
| GET | `/bills/service-charge` | staff | – | `{ pct }` |
| PUT | `/bills/service-charge` | M | `{ pct }` (0–30) | `{ pct }` |
| GET | `/bills/table/:tableId` | W C M | – | open bill of the table, or `null` |
| POST | `/bills/table/:tableId` | W C M | – | `201` new bill or `200` the open one |
| GET | `/bills/:id` | W C M | – | bill: `lines, subtotal, service_charge, total, splits, payments, paid, remaining` |
| POST | `/bills/:id/splits` | W C M | `{ mode: "equal", people }` or `{ mode: "items", groups: [[itemId, ...], ...] }` | `201` bill with `splits` |
| POST | `/bills/:id/payments` | C M | `{ method: "cash" \| "evc_plus" \| "zaad" \| "edahab", splitId?, amount?, amountGiven? (cash), phone? (mobile) }` | `201 { payment: { amount, change, reference }, closed, bill }` |
| GET | `/bills?status=&limit=` | C M | – | recent bills |

## Stock, menu and recipes (manager)
| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/stock/ingredients` | – | ingredients with `stock_qty, min_level, cost_per_unit, low` |
| GET | `/stock/movements` | – | latest 100 movements (`sale, delivery, waste, adjustment`) |
| POST | `/stock/movements` | `{ ingredientId, qty, reason: "delivery" \| "waste" \| "adjustment", unitCost?, note? }` | `{ id, stock_qty }` (409 `NEGATIVE_STOCK`) |
| POST / PATCH / DELETE | `/menu-admin/categories[/:id]` | `{ name_so, name_en, sort_order? }` | `{ id }` |
| POST / PUT / DELETE | `/menu-admin/dishes[/:id]` | `{ category_id, name_so, name_en, description_*?, price > 0, photo_url?, prep_minutes }` | `{ id }` (409 `DISH_NAME_TAKEN`) |
| GET | `/menu-admin/dishes/:id/detail` | – | dish with groups, modifiers and modifier ingredients |
| PATCH | `/menu-admin/dishes/:id` | `{ is_available?, force_unavailable? }` | flags (409 `NO_RECIPE`) |
| GET / PUT | `/menu-admin/dishes/:id/recipe` | `{ items: [{ ingredientId, qty }] }` | recipe rows |
| POST / PUT / DELETE | `/menu-admin/dishes/:id/groups`, `/menu-admin/groups/:id` | `{ name_so, name_en, is_required, min_select, max_select }` | `{ id }` |
| POST / PUT / DELETE | `/menu-admin/groups/:id/modifiers`, `/menu-admin/modifiers/:id` | `{ name_so, name_en, price_delta, ingredients: [{ ingredientId, qty }] }` | `{ id }` |

## Tables, staff, reports, logs (manager)
| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/admin/tables` | `{ number, area, seats, assignedWaiterId? }` | table (with its secret token) |
| PATCH | `/admin/tables/:id` | `{ number?, area?, seats?, is_closed?, assigned_waiter_id? }` | table |
| POST | `/admin/tables/:id/regenerate-qr` | – | table with a new token; phones using the old one are disconnected |
| DELETE | `/admin/tables/:id` | – | `{ ok }` (409 when it has history) |
| GET / POST | `/users` | `{ full_name, username, password, role }` | staff list / new user (no hashes returned) |
| PATCH | `/users/:id` | `{ full_name?, role?, is_active? }` | user |
| POST | `/users/:id/reset-password` | `{ password }` | `{ ok }` |
| GET | `/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` | – | `{ totals, daily, by_dish, by_category, avg_prep_seconds, food_cost: [{ pct, high }] }` |
| GET | `/sms-outbox` | – | simulated SMS messages |
| GET | `/audit-logs` | – | latest 100 sensitive actions |
| GET | `/health` | – | `{ ok: true }` |

## Real-time events (Socket.IO)
Staff connect with `{ auth: { token } }`, phones with `{ auth: { tableToken } }`.

| Event | Rooms | Payload |
|---|---|---|
| `order:pending` | waiters, table | order view |
| `order:confirmed` | kitchen, waiters, table | order view |
| `order:rejected`, `order:moved` | waiters, table (moved: also kitchen and the old table) | order view |
| `item:updated` | kitchen, waiters, table | `{ itemId, orderId, tableId, status }` |
| `item:ready` | waiters | "Ready" alert for the waiter |
| `table:updated` | waiters | `{ id, number, status }` |
| `menu:updated` | everyone | `{}`: reload the menu (stock or availability changed) |
| `table:token-revoked` | table | the QR was replaced, the link no longer works |
