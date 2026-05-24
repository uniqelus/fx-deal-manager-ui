# fx-deal-manager-ui

Демо UI подсистемы обработки FX-сделок **FX-АСУБАНК**.

Статичный фронтенд без бэкенда. Все данные захардкожены прямо в HTML (моковые числа, контрагенты, сделки, журнал аудита). Кнопки и формы имитируют действия через всплывающие тосты, модалки подтверждения и переходы между страницами. Реальной бизнес-логики на клиенте нет — предполагается, что вся логика будет на бэкенде ([fx-deal-manager](https://github.com/uniqelus/fx-deal-manager)).

**Стек:** HTML + CSS + ванильный JS. Без сборки. Без npm.

**Шрифты:** Fraunces (Google Fonts), Geist, Geist Mono — подгружаются с `fonts.googleapis.com`.

## Быстрый старт

Любой HTTP-сервер из корня репозитория:

```bash
python3 -m http.server 8765
```

Открыть в браузере: [http://localhost:8765/](http://localhost:8765/)

Точка входа — `index.html` (страница логина с выбором роли).

## Структура проекта

```
fx-deal-manager-ui/
├── index.html                  # логин, выбор роли
├── dashboard-*.html            # дашборды по ролям
├── deal-*.html                 # создание, просмотр, правка, согласование
├── deals.html, queue.html      # реестр и очередь
├── quotes.html, positions.html # котировки и позиции
├── counterparties.html         # справочник контрагентов
├── accounts.html               # счета банка
├── audit.html, reports.html    # журнал и отчёты
├── notifications.html          # уведомления
├── settings.html               # настройки пользователя
├── css/                        # стили
└── js/app.js                   # единственный JS-файл
```

### HTML-страницы

| Файл | Назначение |
|------|------------|
| `index.html` | Страница логина. Выбор одной из трёх ролей: **Трейдер** / **Позиционер** / **Аудитор**. Записывает роль в `localStorage` (ключ `fx_role`) и редиректит на соответствующий дашборд. |
| `dashboard-trader.html` | Дашборд трейдера: KPI по сделкам, последние сделки, лента курсов, быстрые действия. Доступ только для роли `trader`. |
| `dashboard-positioner.html` | Дашборд позиционера: очередь согласования, лимиты контрагентов. Доступ только для роли `positioner`. |
| `dashboard-auditor.html` | Дашборд аудитора: статистика журнала, последние события. Доступ только для роли `auditor`. |
| `deals.html` | Реестр всех сделок: фильтры по статусу и типу, поиск, пагинация. Клик по строке — на карточку. |
| `deal-new.html` | Форма создания сделки (4 секции: тип/контрагент, валюты/суммы, счета, комментарий). Только `trader`. |
| `deal-detail.html` | Карточка сделки (пример: D-2843, EUR/RUB, SPOT). Hero, stepper статусов, табы Параметры/Платежи/Аудит/Документы. |
| `deal-edit.html` | Правка сделки, возвращённой на исправление (пример: D-2841). Красная плашка с комментарием позиционера. Только `trader`. |
| `deal-review.html` | Сводная форма согласования (пример: D-2842, USD/RUB, TOM). Чек-лист, панель решения, лимит контрагента. Только `positioner`. |
| `queue.html` | Очередь сделок, ожидающих согласования. Только `positioner`. |
| `positions.html` | Валютные позиции и остатки на счетах НОСТРО. Только `positioner`. |
| `quotes.html` | Котировки FX: курсы ЦБ, активные RFQ, маркет-мейкеры. |
| `counterparties.html` | Справочник контрагентов: код, BIC/SWIFT, страна, лимит, загрузка, статус. |
| `accounts.html` | Счета банка: НОСТРО / Расчётные / Транзитные. |
| `audit.html` | Журнал аудита: время, пользователь, сущность, действие, поле, было/стало. |
| `reports.html` | 6 регламентных и аналитических отчётов с просмотром и выгрузкой в XLSX. |
| `notifications.html` | Уведомления (info/warn/danger/success), фильтрация по вкладкам. |
| `settings.html` | Настройки: профиль, безопасность, предпочтения, уведомления. |

### `css/`

| Файл | Назначение |
|------|------------|
| `base.css` | Сброс, CSS-переменные (палитра, шрифты, тени), типографика, утилиты (`.mono`, `.muted`, `.row-2`). |
| `login.css` | Стили страницы логина: брендовая панель, форма выбора роли, адаптив. |
| `shell.css` | Оболочка: sidebar, topbar, хлебные крошки, курсы ЦБ, часы. |
| `components.css` | Кнопки, пилюли статусов, карточки, формы, вкладки, тосты, модалки. |
| `tables.css` | Таблицы, фильтр-бары, пагинация, компактные списки `.mini-list`. |
| `views.css` | Стили страниц: KPI, hero сделки, stepper, таймлайн аудита, sparkline, адаптив. |

### `js/app.js`

Единственный JS-файл. На загрузке страницы:

1. **Роль и навигация** — читает `fx_role` из `localStorage`, скрывает пункты sidebar с неподходящим `data-roles`, подсвечивает активный пункт по `data-page`, заполняет блок пользователя.
2. **Часы** — в топбаре, сайдбаре и на странице логина.
3. **Обработчики `data-*` атрибутов:**
   - `data-toast="title|desc|kind"` — тост
   - `data-go="page.html"` — переход
   - `data-confirm="..."` — модалка подтверждения
   - `data-logout` — выход (очищает роль)
   - `data-back` — `history.back()`
   - `data-role-select="..."` — выбор роли на логине
   - `data-group` / `data-tab-group` — переключение чипов и табов
4. **Role guard** — если у `<body>` указан `data-role-required="..."`, а текущая роль не совпадает, редирект на дашборд своей роли с тостом «Нет доступа».

## Навигация между страницами

```
index.html
   ├── [trader]     → dashboard-trader.html
   ├── [positioner] → dashboard-positioner.html
   └── [auditor]    → dashboard-auditor.html

dashboard-trader.html
   ├── deal-new.html, deals.html, quotes.html, counterparties.html
   └── строки таблицы → deal-detail.html

dashboard-positioner.html
   ├── queue.html, positions.html, counterparties.html
   └── строки таблицы → deal-review.html

dashboard-auditor.html
   ├── audit.html, reports.html, deals.html

deals.html → deal-detail.html (или deal-edit.html для статуса «На исправлении»)
deal-detail.html → deal-edit.html (если статус «На исправлении»)

deal-new.html / deal-edit.html
   ├── quotes.html (кнопка «Открыть панель котировок»)
   └── deals.html (после имитации отправки)

queue.html → deal-review.html → queue.html (после имитации решения)

notifications.html — клик по уведомлению → deal-detail / deal-edit / counterparties / quotes
```

### Sidebar (все страницы кроме `index.html`)

- **Дашборд** — ссылка на `dashboard-{role}.html` (задаётся в `app.js`)
- **Сделки**, **Новая сделка** (только `trader`), **Очередь** / **Позиции** (только `positioner`), **Котировки** (`trader` / `positioner`)
- **Контрагенты**, **Счета банка**
- **Журнал аудита**, **Отчёты**, **Уведомления**, **Настройки**

### Topbar

- Кнопка «назад» (`history.back`)
- Хлебные крошки, курсы ЦБ (статичные), колокольчик → `notifications.html`, помощь (тост), часы

**Logout:** иконка выхода в sidebar — очищает `fx_role` и редиректит на `index.html`.

## Связанные репозитории

| Репозиторий | Описание |
|-------------|----------|
| [fx-deal-manager](https://github.com/uniqelus/fx-deal-manager) | REST API бэкенда (FastAPI) |
| [fx-deal-manager.wiki](https://github.com/uniqelus/fx-deal-manager/wiki) | Документация проекта, в т.ч. [User Interface](https://github.com/uniqelus/fx-deal-manager/wiki/User-Interface) |
