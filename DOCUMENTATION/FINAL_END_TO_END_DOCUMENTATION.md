# Enterprise Asset Management - Final End-to-End Documentation

This document explains the complete Enterprise Asset Management application from database to backend API to React frontend. It is intentionally detailed. It covers package responsibilities, route behavior, middleware, Oracle access, Excel import, React routing, page-level workflows, reusable components, and the way function calls flow through the application.

## 1. Project Purpose

The application is an Enterprise Asset Management system for tracking:

- People who receive assets.
- Hardware inventory.
- Software inventory and license seats.
- Issuing hardware or software to people.
- Taking back issued assets.
- Searching catalog data.
- Viewing dashboard and stats.
- Importing and removing data through Excel.

The architecture is split into two main apps:

- `BACKEND/`: Express API server using Oracle Database.
- `FRONTEND/`: React single page application built with Vite and Tailwind.

There is also:

- `database/`: SQL scripts for schema setup, sample data, and reference queries.
- `samples/`: Excel sample files for import workflows.
- `DOCUMENTATION/`: project documentation files.

## 2. High-Level Architecture

The runtime flow is:

1. User opens the React frontend, usually at `http://127.0.0.1:5173`.
2. React Router displays either `/login` or a protected page under the main layout.
3. Frontend calls the helper function `api(path, options)` from `FRONTEND/src/api.js`.
4. `api()` attaches the JWT bearer token from `localStorage` if available.
5. In development, Vite proxies `/api/*` calls to the Express backend at `http://localhost:5000`.
6. Express receives the request in `BACKEND/src/server.js`.
7. Public auth routes run without JWT middleware.
8. Protected routes run through `authRequired`.
9. Route handlers use `withConnection()` to borrow an Oracle connection from the pool.
10. SQL executes against tables such as `eam_holder`, `eam_hardware`, `eam_software`, `eam_assignment`, and `eam_app_user`.
11. Query results are normalized by `rowsToClients()`.
12. Express returns JSON to the frontend.
13. React stores the result in component state and renders tables, forms, cards, and modals.

## 3. Packages and Their Responsibilities

### 3.1 Backend Packages

Defined in `BACKEND/package.json`.

#### `express`

Used to create the HTTP API server.

Important places:

- `BACKEND/src/server.js`: creates the app and mounts route modules.
- Every file in `BACKEND/src/routes/`: creates an `express.Router()`.

Express responsibilities:

- Parse requests.
- Route URLs to handlers.
- Send JSON responses.
- Run middleware.
- Catch unexpected errors.

#### `cors`

Used in `server.js`:

```js
app.use(cors({ origin: true, credentials: true }));
```

This allows the frontend development server to call the backend API from another origin, such as `localhost:5173` calling `localhost:5000`.

#### `dotenv`

Used in:

- `BACKEND/src/server.js`
- `BACKEND/src/db.js`

It loads variables from `BACKEND/.env`, including:

- `DB_USER`
- `DB_PASSWORD`
- `DB_CONNECT_STRING`
- `JWT_SECRET`
- optionally `PORT`

#### `oracledb`

Used to connect to Oracle Database.

Important files:

- `BACKEND/src/db.js`
- route files that use bind metadata, such as `oracledb.NUMBER` for `RETURNING ... INTO`.

Primary responsibilities:

- Create a connection pool.
- Execute SQL.
- Bind parameters.
- Return rows.
- Commit database transactions.
- Lock rows with `FOR UPDATE` during issue/take-back flows.

#### `bcryptjs`

Used in `BACKEND/src/routes/auth.js`.

Responsibilities:

- Hash user passwords during registration.
- Compare login password with stored hash.

Important calls:

- `bcrypt.hashSync(password, 12)`
- `bcrypt.compareSync(password, data.password_hash)`

#### `jsonwebtoken`

Used in:

- `BACKEND/src/routes/auth.js`
- `BACKEND/src/middleware/auth.js`

Responsibilities:

- Sign JWTs after register/login.
- Verify JWTs for protected API routes.

Important calls:

- `jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: "30d" })`
- `jwt.verify(token, process.env.JWT_SECRET)`

#### `multer`

Used in `BACKEND/src/routes/import.js`.

Responsibilities:

- Accept Excel file uploads.
- Store uploaded file in memory.
- Enforce file size limit.
- Enforce `.xlsx` or `.xls` file type.

Important configuration:

- `storage: multer.memoryStorage()`
- `limits: { fileSize: 10 * 1024 * 1024 }`
- `upload.single("file")`

#### `xlsx`

Used in `BACKEND/src/services/excelParser.js`.

Responsibilities:

- Read uploaded Excel buffers.
- Convert worksheet rows to JavaScript arrays.
- Normalize headers and row values for import processing.

Important calls:

- `XLSX.read(buffer, { type: "buffer", cellDates: true })`
- `XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false })`

#### `nodemon`

Development dependency for backend hot reload.

Used by:

```bash
npm run dev
```

### 3.2 Frontend Packages

Defined in `FRONTEND/package.json`.

#### `react`

Core UI library.

Used for:

- Functional components.
- `useState`
- `useEffect`
- `useMemo`
- `React.StrictMode`

#### `react-dom`

Mounts React into `FRONTEND/index.html`.

Used in `FRONTEND/src/main.jsx`:

```js
ReactDOM.createRoot(document.getElementById("root")).render(...)
```

#### `react-router-dom`

Handles frontend page routing.

Used in:

- `FRONTEND/src/main.jsx` for `BrowserRouter`.
- `FRONTEND/src/App.jsx` for `Routes`, `Route`, `Navigate`, `Outlet`, `NavLink`.
- Several pages for `Link`.

#### `vite`

Frontend build and dev server.

Responsibilities:

- Run local dev server.
- Build production bundle.
- Proxy `/api` requests to the backend in development.

Important commands:

```bash
npm run dev
npm run build
npm run preview
```

#### `@vitejs/plugin-react`

Allows Vite to compile React JSX.

Used in `FRONTEND/vite.config.js`.

#### `tailwindcss` and `@tailwindcss/vite`

Provide utility CSS classes.

Used in:

- `FRONTEND/src/styles.css`
- Tailwind class names across all React components.

## 4. Backend Startup Flow

Main file: `BACKEND/src/server.js`.

### 4.1 Environment Loading

`server.js` calculates the `.env` file path:

```js
const envPath = path.join(__dirname, "..", ".env");
require("dotenv").config({ path: envPath });
```

Since `server.js` lives in `BACKEND/src`, `..` points to `BACKEND`.

### 4.2 Express App Creation

```js
const app = express();
const port = Number(process.env.PORT) || 5000;
```

If `PORT` is not set, backend listens on `5000`.

### 4.3 Global Middleware

```js
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
```

`cors()` allows frontend requests.

`express.json()` parses JSON request bodies for routes like:

- `POST /api/auth/login`
- `POST /api/hardware`
- `POST /api/software`
- `POST /api/assignments/issue-hardware`

### 4.4 Health Route

```http
GET /api/health
```

Returns:

```json
{ "ok": true, "service": "eam-backend" }
```

This route is public.

### 4.5 Route Mounting

Public:

```js
app.use("/api/auth", authRoutes);
```

Protected:

```js
app.use("/api/holders", authRequired, holdersRoutes);
app.use("/api/hardware", authRequired, hardwareRoutes);
app.use("/api/software", authRequired, softwareRoutes);
app.use("/api/assignments", authRequired, assignmentsRoutes);
app.use("/api/dashboard", authRequired, dashboardRoutes);
app.use("/api/stats", authRequired, statsRoutes);
app.use("/api/search", authRequired, searchRoutes);
app.use("/api/import", authRequired, importRoutes);
app.use("/api/dropdowns", authRequired, dropdownsRoutes);
```

Any protected route must receive:

```http
Authorization: Bearer <jwt>
```

### 4.6 Global Error Handler

At the end:

```js
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error" });
});
```

This catches unhandled Express errors and returns JSON.

### 4.7 Server Start and Shutdown

`start()`:

1. Calls `initPool()` to create the Oracle pool.
2. Starts Express listener.
3. Registers `SIGINT` and `SIGTERM` handlers.

On shutdown:

1. Closes HTTP server.
2. Calls `closePool()`.
3. Exits process.

## 5. Oracle Database Utility Layer

Main file: `BACKEND/src/db.js`.

### 5.1 `oracledb.outFormat`

```js
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
```

This makes Oracle return each row as an object instead of an array.

Example raw row:

```js
{ HARDWARE_ID: 1, ASSET_TAG: "LT-001" }
```

The app then converts keys to lowercase with `rowsToClients()`.

### 5.2 `initPool()`

Purpose:

- Create the Oracle connection pool once.
- Reuse it for all future requests.

Flow:

1. If `pool` already exists, return it.
2. Otherwise call `oracledb.createPool()`.
3. Use `.env` values for credentials.
4. Set `poolMin`, `poolMax`, and `poolIncrement`.

Pool config:

```js
{
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
  poolMin: 1,
  poolMax: 8,
  poolIncrement: 1
}
```

### 5.3 `withConnection(handler)`

Purpose:

- Centralize connection checkout and cleanup.

Flow:

1. Calls `initPool()`.
2. Gets one connection with `p.getConnection()`.
3. Passes the connection into `handler(conn)`.
4. Always closes connection in `finally`.

This function is used by nearly every route:

```js
const rows = await withConnection(async (conn) => {
  const r = await conn.execute("SELECT ...");
  return rowsToClients(r);
});
```

Important detail:

- `withConnection()` does not commit automatically.
- Mutating routes call `await conn.commit()` themselves.

### 5.4 `closePool()`

Purpose:

- Gracefully close Oracle pool on server shutdown.

If `pool` exists:

1. Calls `pool.close(10)`.
2. Clears the module-level `pool` variable.

## 6. Backend Row Normalization

Main file: `BACKEND/src/util.js`.

### 6.1 `rowsToClients(result)`

Purpose:

- Convert Oracle result rows into frontend-friendly JSON.

Behavior:

1. If there are no rows, return `[]`.
2. For every row:
   - Lowercase every object key.
   - Convert JavaScript `Date` objects to ISO strings.

Example:

Oracle-style:

```js
{ HOLDER_ID: 1, FULL_NAME: "Ada", CREATED_AT: Date }
```

Frontend-style:

```js
{ holder_id: 1, full_name: "Ada", created_at: "2026-06-03T..." }
```

This is why the React code can consistently use lowercase names like:

- `row.hardware_id`
- `row.asset_tag`
- `row.full_name`

## 7. Authentication Middleware

Main file: `BACKEND/src/middleware/auth.js`.

### 7.1 `authRequired(req, res, next)`

Purpose:

- Block protected API routes unless a valid JWT bearer token is present.

Flow:

1. Reads `req.headers.authorization`.
2. Checks whether it starts with `"Bearer "`.
3. Extracts token after the first 7 characters.
4. If token is missing, returns:

```http
401
{ "error": "Missing bearer token" }
```

5. Calls:

```js
jwt.verify(token, process.env.JWT_SECRET)
```

6. If token is valid:
   - Stores decoded payload in `req.user`.
   - Calls `next()`.

7. If token is invalid or expired:

```http
401
{
  "error": "Invalid or expired token",
  "details": "<jwt error message>"
}
```

### 7.2 How `req.user` Is Used

Assignment routes use:

```js
const issuedBy = Number(req.user.userId);
```

That links assignment records to the logged-in app user through `issued_by`.

## 8. Authentication Routes

Main file: `BACKEND/src/routes/auth.js`.

Mounted at:

```http
/api/auth
```

These routes are public.

### 8.1 `POST /api/auth/register`

Purpose:

- Create a new app login user.
- Hash password.
- Return JWT token.

Request body:

```json
{
  "email": "user@example.com",
  "password": "secret",
  "full_name": "User Name"
}
```

Validation:

- `email` required.
- `password` required.
- `full_name` optional, defaults to empty string.

Flow:

1. Reads request body.
2. Trims and lowercases email.
3. Hashes password:

```js
const hash = bcrypt.hashSync(password, 12);
```

4. Inserts into `eam_app_user`.
5. Selects new user record.
6. Commits transaction.
7. Signs JWT:

```js
jwt.sign({ userId: row.user_id, email: row.email }, process.env.JWT_SECRET, {
  expiresIn: "30d",
});
```

8. Returns:

```json
{
  "user": {
    "user_id": 1,
    "email": "user@example.com",
    "full_name": "User Name",
    "created_at": "..."
  },
  "token": "..."
}
```

Error behavior:

- Duplicate email returns `409`.
- Other errors return `500`.

### 8.2 `POST /api/auth/login`

Purpose:

- Authenticate an existing user.
- Return JWT token and user profile.

Request body:

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

Flow:

1. Lowercases email.
2. Selects user by email from `eam_app_user`.
3. If user does not exist, returns `401`.
4. Compares password:

```js
bcrypt.compareSync(password, data.password_hash)
```

5. If password is wrong, returns `401`.
6. Signs JWT.
7. Removes `password_hash` from returned user.
8. Returns:

```json
{
  "user": { "...": "..." },
  "token": "..."
}
```

## 9. People / Holders Routes

Main file: `BACKEND/src/routes/holders.js`.

Mounted at:

```http
/api/holders
```

Protected by `authRequired`.

### 9.1 `GET /api/holders`

Purpose:

- List people who can receive assets.

SQL:

```sql
SELECT holder_id, full_name, email, department, contract_ref
FROM eam_holder
ORDER BY full_name
```

Response:

```json
[
  {
    "holder_id": 1,
    "full_name": "Ada Lovelace",
    "email": "ada@example.com",
    "department": "Engineering",
    "contract_ref": "CNT-2024-001"
  }
]
```

### 9.2 `POST /api/holders`

Purpose:

- Create a person/holder.

Request:

```json
{
  "full_name": "Ada Lovelace",
  "email": "ada@example.com",
  "department": "Engineering",
  "contract_ref": "CNT-2024-001"
}
```

Validation:

- `full_name` is required.
- `email` is optional but normalized to lowercase if present.

Flow:

1. Validate `full_name`.
2. Insert into `eam_holder`.
3. Use `RETURNING holder_id INTO :hid`.
4. Select the created row.
5. Commit.
6. Return `201` with the created holder.

Error behavior:

- Duplicate email returns `409`.
- Other failures return `500`.

## 10. Hardware Routes

Main file: `BACKEND/src/routes/hardware.js`.

Mounted at:

```http
/api/hardware
```

Protected by `authRequired`.

### 10.1 Hardware Extra Field Compatibility Layer

The database table stores core columns directly:

- `hardware_id`
- `asset_tag`
- `name`
- `category`
- `model`
- `status`
- `contract_ref`
- `purchase_date`
- `notes`
- `created_at`

The enhanced UI also captures legacy-style fields:

- `platform`
- `make`
- `serial_number`
- `asset_number`
- `asset_group`
- `asset_source`
- `purchase_order`
- `warranty_date`
- `date_received`
- `date_issued`
- `user_name`
- `staff_no`
- `user_account`
- `division`
- `place`
- `location`
- `field_user_address`
- `comments`

To avoid requiring an Oracle migration, those extra fields are packed into `notes` as JSON:

```json
{
  "__eam_extra": true,
  "notes": "plain note text",
  "extra": {
    "platform": "Biometric Devices",
    "make": "HP",
    "division": "DTG"
  }
}
```

### 10.2 `extraFields`

Defines which body keys are packed into `notes`.

### 10.3 `packNotes(body)`

Purpose:

- Combine plain notes/comments plus extra UI fields into one JSON string.

Flow:

1. Create empty `extra` object.
2. Loop through `extraFields`.
3. If the body contains a non-empty value, trim it and store it in `extra`.
4. Get plain note text from `body.notes || body.comments`.
5. If no extra fields exist, return plain notes or `null`.
6. If extra fields exist, return JSON string with `__eam_extra: true`.

### 10.4 `parseNotes(notes)`

Purpose:

- Reverse `packNotes()` when data is read from the database.

Flow:

1. If notes are empty, return `{ notes: "", extra: {} }`.
2. Try `JSON.parse(notes)`.
3. If parsed object has `__eam_extra === true`, return:
   - `notes: parsed.notes`
   - `extra: parsed.extra`
4. If JSON parse fails, treat notes as legacy plain text and expose it as `comments`.

### 10.5 `normalizeHardware(row)`

Purpose:

- Merge unpacked extra fields into the hardware row returned to the frontend.

Example output:

```json
{
  "hardware_id": 1,
  "asset_tag": "G-MOUSE",
  "name": "Mouse",
  "category": "Biometric Devices",
  "model": "",
  "notes": "",
  "make": "HP",
  "division": "DTG",
  "user_name": "DWAIPAYAN BISWAS"
}
```

### 10.6 `GET /api/hardware`

Purpose:

- List hardware inventory.
- Optionally filter by category.

Query parameter:

```http
/api/hardware?category=laptop
```

Flow:

1. Reads `req.query.category`.
2. Builds base SQL.
3. If category exists, adds:

```sql
WHERE LOWER(category) LIKE '%' || LOWER(:cat) || '%'
```

4. Orders by `asset_tag`.
5. Converts rows with `rowsToClients`.
6. Maps rows through `normalizeHardware`.
7. Returns JSON.

### 10.7 `GET /api/hardware/:id`

Purpose:

- Load one hardware record by primary key.

Flow:

1. Converts `req.params.id` to number.
2. Selects row by `hardware_id`.
3. Normalizes extra notes.
4. If missing, returns `404`.
5. Otherwise returns row.

### 10.8 `POST /api/hardware`

Purpose:

- Add a hardware asset.

Required body fields:

- `asset_tag`
- `name`

Common body fields:

- `category`
- `model`
- `status`
- `contract_ref`
- `purchase_date`
- `notes`
- all extra hardware fields listed above.

Flow:

1. Trim `asset_tag`.
2. Trim `name`.
3. If either is missing, return `400`.
4. Insert into `eam_hardware`.
5. Core columns are inserted directly.
6. Extra fields are packed by `packNotes(body)`.
7. Uses `RETURNING hardware_id INTO :hid`.
8. Selects created row.
9. Commits.
10. Normalizes row.
11. Returns `201`.

Error behavior:

- Unique asset tag violation returns `409`.
- Other failures return `500`.

## 11. Software Routes

Main file: `BACKEND/src/routes/software.js`.

Mounted at:

```http
/api/software
```

Protected by `authRequired`.

### 11.1 Software Extra Field Compatibility Layer

Core database columns:

- `software_id`
- `name`
- `version_label`
- `license_type`
- `total_licenses`
- `seats_in_use`
- `contract_ref`
- `notes`
- `created_at`

Enhanced UI fields packed into `notes`:

- `platform`
- `vendor`
- `date_purchased`
- `status`
- `user_owner`
- `division`
- `location`
- `comments`

The same pattern as hardware is used:

- `packNotes(body)` stores extra fields.
- `parseNotes(notes)` reads extra fields.
- `normalizeSoftware(row)` merges them into API response rows.

### 11.2 `GET /api/software`

Purpose:

- List software inventory.

SQL:

```sql
SELECT software_id, name, version_label, license_type, total_licenses, seats_in_use,
       contract_ref, notes, created_at
FROM eam_software
ORDER BY name
```

Then each row is passed through `normalizeSoftware()`.

### 11.3 `GET /api/software/:id`

Purpose:

- Load one software record.

Flow:

1. Select by `software_id`.
2. Normalize notes/extra fields.
3. Return `404` if missing.
4. Return row if found.

### 11.4 `POST /api/software`

Purpose:

- Add a software product/license record.

Required:

- `name`

Optional:

- `version_label`
- `license_type`
- `total_licenses`
- `seats_in_use`
- `contract_ref`
- `notes`
- extra software fields.

Flow:

1. Trim `name`.
2. If missing, return `400`.
3. Insert core fields into `eam_software`.
4. Convert numeric fields with `Number(...)`.
5. Store extra fields through `packNotes(body)`.
6. Use `RETURNING software_id INTO :sid`.
7. Select created row.
8. Commit.
9. Normalize response.
10. Return `201`.

## 12. Assignment Routes

Main file: `BACKEND/src/routes/assignments.js`.

Mounted at:

```http
/api/assignments
```

Protected by `authRequired`.

Assignments connect one holder to either:

- one hardware row, or
- one software row.

An open assignment is one where:

```sql
returned_at IS NULL
```

### 12.1 `GET /api/assignments/open`

Purpose:

- List all currently issued hardware/software.
- Used by Take Back page and Stats page.

SQL joins:

- `eam_assignment a`
- `eam_holder h`
- `eam_hardware hw`
- `eam_software sw`

Selected data includes:

- assignment IDs
- holder details
- hardware details
- software details
- issued/returned timestamps
- notes
- issued_by

Only open rows are returned:

```sql
WHERE a.returned_at IS NULL
```

Sorted newest first:

```sql
ORDER BY a.issued_at DESC
```

### 12.2 `POST /api/assignments/issue-hardware`

Purpose:

- Issue one hardware asset to one holder.

Request:

```json
{
  "holder_id": 1,
  "hardware_id": 10,
  "notes": "Optional note"
}
```

Validation:

- `holder_id` required.
- `hardware_id` required.

Transaction flow:

1. Convert IDs to numbers.
2. Get `issuedBy` from `req.user.userId`.
3. Lock the hardware row:

```sql
SELECT hardware_id, status
FROM eam_hardware
WHERE hardware_id = :id
FOR UPDATE
```

4. If hardware not found, throw `not_found`.
5. If status is not `AVAILABLE`, throw `not_available`.
6. Check duplicate open assignment:

```sql
SELECT COUNT(*) AS cnt
FROM eam_assignment
WHERE hardware_id = :id
  AND returned_at IS NULL
```

7. If count is greater than 0, throw `already_issued`.
8. Insert assignment:

```sql
INSERT INTO eam_assignment (holder_id, hardware_id, notes, issued_by)
VALUES (:holderId, :hardwareId, :notes, :issuedBy)
RETURNING assignment_id INTO :aid
```

9. Update hardware status:

```sql
UPDATE eam_hardware
SET status = 'ISSUED'
WHERE hardware_id = :id
```

10. Select the created assignment with holder/asset details.
11. Commit.
12. Return `201`.

Error mapping:

- `not_found` -> `404 Hardware not found`
- `not_available` -> `409 Hardware is not available`
- `already_issued` -> `409 Hardware already has an open assignment`
- other -> `500 Issue transaction failed`

### 12.3 `POST /api/assignments/issue-software`

Purpose:

- Issue one software license seat to one holder.

Request:

```json
{
  "holder_id": 1,
  "software_id": 20,
  "notes": "Optional note"
}
```

Validation:

- `holder_id` required.
- `software_id` required.

Transaction flow:

1. Convert IDs to numbers.
2. Get `issuedBy` from JWT.
3. Lock software row:

```sql
SELECT software_id, total_licenses, seats_in_use
FROM eam_software
WHERE software_id = :id
FOR UPDATE
```

4. If software missing, throw `not_found`.
5. Convert `total_licenses` and `seats_in_use` to numbers.
6. If `total_licenses > 0` and `seats_in_use >= total_licenses`, throw `no_seats`.
7. Insert assignment with `software_id`.
8. Increment seats:

```sql
UPDATE eam_software
SET seats_in_use = seats_in_use + 1
WHERE software_id = :id
```

9. Select created assignment with joined details.
10. Commit.
11. Return `201`.

Error mapping:

- `not_found` -> `404 Software not found`
- `no_seats` -> `409 No available license seats`
- other -> `500 Software issue failed`

### 12.4 `POST /api/assignments/:id/take-back`

Purpose:

- Close one open assignment.
- Restore hardware availability or decrement software seats.

Route parameter:

```http
/api/assignments/123/take-back
```

Transaction flow:

1. Convert assignment ID to number.
2. Lock open assignment:

```sql
SELECT assignment_id, hardware_id, software_id
FROM eam_assignment
WHERE assignment_id = :id
  AND returned_at IS NULL
FOR UPDATE
```

3. If no open assignment exists, throw `not_found`.
4. Mark returned:

```sql
UPDATE eam_assignment
SET returned_at = SYSTIMESTAMP
WHERE assignment_id = :id
```

5. If assignment has `hardware_id`, update hardware:

```sql
UPDATE eam_hardware
SET status = 'AVAILABLE'
WHERE hardware_id = :id
```

6. If assignment has `software_id`, decrement seats:

```sql
UPDATE eam_software
SET seats_in_use = GREATEST(seats_in_use - 1, 0)
WHERE software_id = :id
```

7. Commit.
8. Return:

```json
{ "ok": true, "assignment_id": 123 }
```

## 13. Dashboard Routes

Main file: `BACKEND/src/routes/dashboard.js`.

Mounted at:

```http
/api/dashboard
```

Protected by `authRequired`.

### 13.1 `GET /api/dashboard/activity`

Purpose:

- Return recent assignment activity for dashboard feeds.

SQL:

- Selects the latest 40 assignment rows.
- Joins holder, hardware, and software.
- Calculates `state`:

```sql
CASE WHEN a.returned_at IS NULL THEN 'OPEN' ELSE 'RETURNED' END AS state
```

Returned shape:

```json
{
  "software": [],
  "hardware": [],
  "combined": []
}
```

Flow:

1. Query latest 40 assignment rows.
2. Convert rows.
3. Split rows into `hardwareFeed` and `softwareFeed`.
4. Add display fields:
   - `label`
   - `asset_tag`
   - `state`
5. Return grouped feeds plus original combined data.

## 14. Stats Routes

Main file: `BACKEND/src/routes/stats.js`.

Mounted at:

```http
/api/stats
```

Protected by `authRequired`.

### 14.1 `GET /api/stats/contracts`

Purpose:

- Return contract-aligned metrics.

Returns three arrays:

```json
{
  "open_by_holder_contract": [],
  "hardware_by_contract": [],
  "software_by_contract": []
}
```

#### `open_by_holder_contract`

Counts open assignments grouped by holder contract:

```sql
SELECT NVL(h.contract_ref, '(none)') AS contract_ref,
       COUNT(*) AS open_assignments
FROM eam_assignment a
JOIN eam_holder h ON h.holder_id = a.holder_id
WHERE a.returned_at IS NULL
GROUP BY h.contract_ref
ORDER BY open_assignments DESC
```

#### `hardware_by_contract`

Counts hardware rows grouped by hardware contract:

```sql
SELECT NVL(contract_ref, '(none)') AS contract_ref,
       COUNT(*) AS hardware_units
FROM eam_hardware
GROUP BY contract_ref
ORDER BY hardware_units DESC
```

#### `software_by_contract`

Aggregates license seat counts by software contract:

```sql
SELECT NVL(contract_ref, '(none)') AS contract_ref,
       SUM(seats_in_use) AS seats_in_use,
       SUM(total_licenses) AS total_licenses
FROM eam_software
GROUP BY contract_ref
ORDER BY seats_in_use DESC
```

### 14.2 `GET /api/stats/summary`

Purpose:

- Return dashboard summary counts.

Counts:

- total hardware
- total software
- open assignments

Response:

```json
{
  "hardware": 100,
  "software": 20,
  "open_assignments": 15
}
```

## 15. Search Route

Main file: `BACKEND/src/routes/search.js`.

Mounted at:

```http
/api/search
```

Protected by `authRequired`.

### 15.1 `GET /api/search?q=value`

Purpose:

- Unified search over hardware and software.

If `q` is empty:

```json
[]
```

SQL uses `UNION ALL`:

1. Hardware search:
   - `LOWER(name) LIKE ...`
   - `LOWER(asset_tag) LIKE ...`

2. Software search:
   - `LOWER(name) LIKE ...`

Return rows include:

- `kind`: `HARDWARE` or `SOFTWARE`
- `id`
- `name`
- `detail`

Frontend uses `kind` to decide whether to link user to `/hardware` or `/software`.

## 16. Dropdown Routes

Main file: `BACKEND/src/routes/dropdowns.js`.

Mounted at:

```http
/api/dropdowns
```

Protected by `authRequired`.

### 16.1 `GET /api/dropdowns/hardware/categories`

Purpose:

- Return distinct non-null hardware categories.

SQL:

```sql
SELECT DISTINCT category
FROM eam_hardware
WHERE category IS NOT NULL
ORDER BY category
```

Response:

```json
["Laptop", "Monitor", "Printer"]
```

### 16.2 `GET /api/dropdowns/hardware/models`

Purpose:

- Return distinct non-null hardware models.

SQL:

```sql
SELECT DISTINCT model
FROM eam_hardware
WHERE model IS NOT NULL
ORDER BY model
```

### 16.3 `GET /api/dropdowns/software/license-types`

Purpose:

- Return distinct non-null software license types.

SQL:

```sql
SELECT DISTINCT license_type
FROM eam_software
WHERE license_type IS NOT NULL
ORDER BY license_type
```

## 17. Import Routes

Main file: `BACKEND/src/routes/import.js`.

Mounted at:

```http
/api/import
```

Protected by `authRequired`.

### 17.1 Import Categories

Defined in `excelParser.js`:

```js
["people", "hardware", "software", "issues"]
```

### 17.2 Sample Files

Mapped in `import.js`:

- `people` -> `People.xlsx`
- `hardware` -> `Hardware.xlsx`
- `software` -> `Software.xlsx`
- `issues` -> `Issues.xlsx`

Samples are read from root `samples/`.

### 17.3 Multer Upload Configuration

`upload` uses:

- memory storage
- 10 MB limit
- `.xlsx` / `.xls` extension validation
- Excel MIME type validation

The upload field name must be:

```txt
file
```

### 17.4 `GET /api/import/categories`

Purpose:

- Return available import categories and metadata.

Response includes:

- category ID
- label
- target table
- sample file
- upload endpoint
- sample endpoint
- recommended import order

Recommended order:

```json
["people", "hardware", "software", "issues"]
```

This order matters because issue rows reference people and assets.

### 17.5 `GET /api/import/samples/:category`

Purpose:

- Download a sample Excel file.

Flow:

1. Read `category` route param.
2. Look up sample filename.
3. If category is unknown, return `404`.
4. If file does not exist, return `404`.
5. Use `res.download(filePath, filename)`.

### 17.6 `POST /api/import/:category`

Purpose:

- Upload and process an Excel file for one category.

Flow:

1. Route is registered once for each `IMPORT_CATEGORIES` value.
2. `upload.single("file")` loads the file into memory.
3. If no file is present, return `400`.
4. Calls:

```js
importCategoryBuffer(req.file.buffer, category, Number(req.user.userId))
```

5. Returns:

```json
{
  "ok": true,
  "category": "hardware",
  "filename": "Hardware.xlsx",
  "summary": {
    "category": "hardware",
    "sheetName": "Hardware",
    "rowCount": 10,
    "inserted": 5,
    "updated": 3,
    "removed": 1,
    "skipped": 1,
    "errors": []
  }
}
```

### 17.7 Import Error Middleware

At the end of `import.js`:

- `multer.MulterError` returns `400`.
- Other upload errors return `400`.
- Otherwise continues to next middleware.

## 18. Excel Parser Service

Main file: `BACKEND/src/services/excelParser.js`.

Purpose:

- Convert an uploaded workbook into normalized row objects.

### 18.1 `IMPORT_CATEGORIES`

Valid import categories:

- `people`
- `hardware`
- `software`
- `issues`

### 18.2 `SHEET_ALIASES`

Allows flexible worksheet names.

Examples:

- people sheet can be named `people`, `holders`, `holder`, `employees`.
- hardware sheet can be named `hardware` or `hw`.
- software sheet can be named `software`, `sw`, or `licenses`.
- issues sheet can be named `issues`, `assignments`, `issue`, or `transactions`.

### 18.3 `COLUMN_ALIASES`

Allows flexible Excel column headers.

Examples:

- `full_name` accepts `full_name`, `fullname`, `employee_name`, `person`.
- `asset_tag` accepts `asset_tag`, `tag`, `asset_id`, `serial`.
- `license_type` accepts `license_type`, `licence_type`, `license`.
- `holder_ref` accepts `holder_email_or_name`, `holder_ref`, `assignee`, `holder`.

### 18.4 `normalizeKey(value)`

Purpose:

- Convert headers and sheet names into comparable keys.

It:

1. Trims.
2. Lowercases.
3. Removes asterisks.
4. Replaces non-alphanumeric runs with `_`.
5. Removes leading/trailing underscores.

Example:

```txt
"Employee Name *" -> "employee_name"
```

### 18.5 `resolveCanonical(header)`

Purpose:

- Convert an Excel header into the canonical field name used by import handlers.

Flow:

1. Normalize header.
2. Loop over `COLUMN_ALIASES`.
3. If normalized header matches an alias, return canonical field.
4. Otherwise return normalized key itself.

### 18.6 Cell Conversion Helpers

#### `cellString(value)`

Returns:

- `null` for empty cells.
- ISO date prefix for Date values.
- trimmed string for other values.

#### `cellNumber(value)`

Returns:

- `null` for empty cells.
- numeric value if finite.
- `null` for non-numeric content.

#### `cellEmail(value)`

Returns lowercase email text or `null`.

#### `parseDate(value)`

Accepts:

- JavaScript `Date`
- parseable date strings
- Excel serial numbers greater than `20000`

Returns:

- `Date`
- or `null`

#### `normalizeStatus(value)`

Maps many human status labels into:

- `AVAILABLE`
- `ISSUED`
- `RETIRED`

Examples:

- `Inventory`, `Active`, `In Stock` -> `AVAILABLE`
- `Issued`, `In Use`, `Assigned` -> `ISSUED`
- `Retired`, `Disposed`, `Inactive` -> `RETIRED`

#### `normalizeImportAction(value)`

Used for people/hardware/software imports.

Maps:

- blank -> `upsert`
- `add`, `upsert`, `update`, `insert`, `create` -> `upsert`
- `remove`, `delete`, `del`, `drop` -> `remove`

#### `normalizeAction(value)`

Used for issue imports.

Maps:

- `issue`, `assign`, `issued`, `allocate`, `add` -> `issue`
- `return`, `take back`, `takeback`, `take_back`, `returned`, `close`, `remove`, `delete` -> `return`

#### `parseHolderRef(value)`

If value contains `@`, treats it as an email.

Otherwise treats it as a full name.

### 18.7 Workbook and Sheet Helpers

#### `findSheet(workbook, aliases)`

Finds a sheet whose normalized name equals one of the aliases.

#### `matrixToRows(matrix)`

Converts a worksheet matrix into objects.

Flow:

1. First row is treated as headers.
2. Headers are canonicalized.
3. Data rows start at row 2.
4. Blank rows are skipped.
5. Each row gets `__row` containing the 1-based Excel row number.

#### `sheetToRows(workbook, sheetAliases)`

Looks up a sheet and converts it to rows.

#### `buildWorkbookFromBuffer(buffer)`

Reads the workbook from uploaded file bytes.

#### `parseCategoryWorkbook(buffer, category)`

Main parser entry.

Flow:

1. Validate category.
2. Build workbook.
3. Try category-specific sheet aliases.
4. If no alias matches and there is one sheet, use that sheet.
5. If no alias matches and workbook has sheets, use first sheet.
6. Convert sheet to rows.
7. If no rows exist, throw `400`.
8. Return `{ sheetName, rows, category }`.

## 19. Excel Import Service

Main file: `BACKEND/src/services/excelImport.js`.

Purpose:

- Convert parsed Excel rows into database inserts, updates, removes, issue transactions, and return transactions.

### 19.1 `resultBucket()`

Creates import summary:

```js
{
  inserted: 0,
  updated: 0,
  removed: 0,
  skipped: 0,
  errors: []
}
```

### 19.2 `addError(bucket, row, message)`

Adds:

```js
{ row, message }
```

to `bucket.errors`.

### 19.3 `findHolderId(conn, { email, fullName })`

Purpose:

- Resolve a person by email first, then full name.

Flow:

1. If email exists, query `eam_holder` by lowercased email.
2. If found, return `holder_id`.
3. If fullName exists, query by uppercase `full_name`.
4. Return `holder_id` or `null`.

### 19.4 `resolveAssetRef(conn, ref)`

Purpose:

- Decide whether a combined import asset reference points to hardware or software.

Flow:

1. If no reference, return both null.
2. Search hardware by `asset_tag`.
3. If found, return `{ assetTag: ref, softwareName: null }`.
4. Search software by name.
5. If found, return `{ assetTag: null, softwareName: ref }`.
6. If reference looks like hardware tag (`HW-...` or uppercase code), treat as hardware.
7. Otherwise treat as software.

### 19.5 `closeOpenAssignmentsForHolder(conn, holderId)`

Purpose:

- Close all open hardware/software assignments for a holder before deleting the holder.

Hardware branch:

1. Select open hardware assignments.
2. Set `returned_at = SYSTIMESTAMP`.
3. Set hardware status to `AVAILABLE`.

Software branch:

1. Select open software assignments.
2. Set `returned_at = SYSTIMESTAMP`.
3. Decrement `seats_in_use` with `GREATEST(seats_in_use - 1, 0)`.

### 19.6 Remove Helpers

#### `removePerson(conn, row, bucket)`

Requires email or full name.

Flow:

1. Resolve holder.
2. Close open assignments.
3. Delete assignments for holder.
4. Delete holder.
5. Update summary counts.

#### `removeHardware(conn, row, bucket)`

Requires `asset_tag`.

Flow:

1. Find hardware by asset tag.
2. Close open assignments for that hardware.
3. Delete assignment history for hardware.
4. Delete hardware row.
5. Update summary.

#### `removeSoftware(conn, row, bucket)`

Requires `name`.

Flow:

1. Find software by name and version.
2. Close open assignments for that software.
3. Delete assignment history for software.
4. Delete software row.
5. Update summary.

### 19.7 `importPeople(conn, rows, bucket)`

Purpose:

- Upsert or remove people from Excel.

Per row flow:

1. Normalize `action`.
2. If action is `remove`, call `removePerson`.
3. Otherwise parse:
   - `full_name`
   - `email`
   - `department`
   - `contract_ref`
4. Require `full_name`.
5. If email exists and an existing holder matches:
   - update full name, department, contract.
   - increment `updated`.
6. Otherwise insert new holder.
7. Increment `inserted`.

### 19.8 `importHardware(conn, rows, bucket)`

Purpose:

- Upsert or remove hardware from Excel.

Per row flow:

1. Normalize `action`.
2. If action is `remove`, call `removeHardware`.
3. Otherwise parse:
   - `asset_tag`
   - `name`
   - `category`
   - `model`
   - `status`
   - `contract_ref`
   - `purchase_date`
   - `notes`
4. Require `asset_tag` and `name`.
5. Find existing hardware by asset tag.
6. If found, update fields.
7. If not found, insert row.

### 19.9 `importSoftware(conn, rows, bucket)`

Purpose:

- Upsert or remove software from Excel.

Per row flow:

1. Normalize `action`.
2. If action is `remove`, call `removeSoftware`.
3. Otherwise parse:
   - `name`
   - `version_label`
   - `license_type`
   - `total_licenses`
   - `seats_in_use`
   - `contract_ref`
   - `notes`
4. Require `name`.
5. Find existing row by name and version.
6. If found, update license fields.
7. If not found, insert.

### 19.10 Issue Import Helpers

#### `issueHardware(conn, holderId, assetTag, notes, issuedBy, rowNum, bucket)`

Same core logic as API route:

1. Lock hardware by asset tag.
2. Require status `AVAILABLE`.
3. Ensure no open assignment.
4. Insert assignment.
5. Update hardware status to `ISSUED`.
6. Increment `inserted`.

#### `returnHardware(conn, holderId, assetTag, rowNum, bucket)`

Flow:

1. Find hardware by asset tag.
2. Find open assignment for holder and hardware with `FOR UPDATE`.
3. Set `returned_at`.
4. Set hardware status `AVAILABLE`.
5. Increment `updated`.

#### `issueSoftware(conn, holderId, softwareName, softwareVersion, notes, issuedBy, rowNum, bucket)`

Flow:

1. Find software by name and version with `FOR UPDATE`.
2. Check seat availability.
3. Insert assignment.
4. Increment `seats_in_use`.
5. Increment `inserted`.

#### `returnSoftware(conn, holderId, softwareName, softwareVersion, rowNum, bucket)`

Flow:

1. Find software by name/version.
2. Find latest open assignment for holder/software.
3. Set `returned_at`.
4. Decrement `seats_in_use`.
5. Increment `updated`.

### 19.11 `importIssues(conn, rows, bucket, issuedBy)`

Purpose:

- Import issue/return rows from Excel.

Per row flow:

1. Normalize action with `normalizeAction`.
2. Resolve holder email/name.
3. Resolve asset reference:
   - explicit hardware asset tag
   - explicit software name
   - combined asset ref
4. Validate:
   - action exists
   - holder ref exists
   - one asset ref exists
   - not both hardware and software
5. Find holder.
6. If holder missing, error says import People first.
7. If action is `issue`, call issue helper.
8. If action is `return` or `remove`, call return helper.

### 19.12 `importCategoryBuffer(buffer, category, issuedBy)`

Main import service entry.

Flow:

1. Validate category.
2. Parse workbook:

```js
const { sheetName, rows } = parseCategoryWorkbook(buffer, category);
```

3. Create summary bucket.
4. Open DB connection with `withConnection`.
5. Select handler from `IMPORT_HANDLERS`.
6. For issues, pass `issuedBy`.
7. For other categories, call handler without `issuedBy`.
8. Commit once at the end.
9. Return summary.

## 20. Database Model

The documentation below is based on route SQL, seed scripts, and query reference scripts.

### 20.1 `eam_app_user`

Purpose:

- Stores application login users.

Used by:

- `POST /api/auth/register`
- `POST /api/auth/login`

Important fields:

- `user_id`
- `email`
- `password_hash`
- `full_name`
- `created_at`

### 20.2 `eam_holder`

Purpose:

- Stores people/employees/holders who can receive assets.

Used by:

- holders routes
- assignment routes
- import people
- stats by holder contract

Important fields:

- `holder_id`
- `full_name`
- `email`
- `department`
- `contract_ref`

### 20.3 `eam_hardware`

Purpose:

- Stores hardware asset inventory.

Used by:

- hardware routes
- assignment issue/take-back
- imports
- dashboard
- stats
- search

Important fields:

- `hardware_id`
- `asset_tag`
- `name`
- `category`
- `model`
- `status`
- `contract_ref`
- `purchase_date`
- `notes`
- `created_at`

Important status values:

- `AVAILABLE`
- `ISSUED`
- `RETIRED`

### 20.4 `eam_software`

Purpose:

- Stores software products/licenses.

Used by:

- software routes
- assignment issue/take-back
- imports
- dashboard
- stats
- search

Important fields:

- `software_id`
- `name`
- `version_label`
- `license_type`
- `total_licenses`
- `seats_in_use`
- `contract_ref`
- `notes`
- `created_at`

### 20.5 `eam_assignment`

Purpose:

- Stores asset issuance history.

Used by:

- issue workflows
- take-back workflows
- dashboard activity
- stats
- import issues

Important fields:

- `assignment_id`
- `holder_id`
- `hardware_id`
- `software_id`
- `issued_at`
- `returned_at`
- `notes`
- `issued_by`

Open assignment:

```sql
returned_at IS NULL
```

Closed assignment:

```sql
returned_at IS NOT NULL
```

## 21. Frontend Startup and Routing

### 21.1 `FRONTEND/src/main.jsx`

Flow:

1. Imports React.
2. Imports ReactDOM.
3. Imports `BrowserRouter`.
4. Imports `App`.
5. Imports `styles.css`.
6. Mounts the app into `#root`.

Structure:

```jsx
<React.StrictMode>
  <BrowserRouter>
    <App />
  </BrowserRouter>
</React.StrictMode>
```

`BrowserRouter` enables client-side URL routing.

### 21.2 `FRONTEND/src/App.jsx`

Responsibilities:

- Defines layout.
- Defines private route guard.
- Defines all frontend routes.
- Provides navigation.
- Handles sign out.

### 21.3 `Layout()`

Renders:

- top header
- EAM brand link
- navigation links
- sign out button
- `<Outlet />` for active page
- footer

Navigation routes:

- `/`
- `/hardware`
- `/software`
- `/holders`
- `/issue`
- `/take-back`
- `/search`
- `/stats`

Sign out button:

1. Calls `clearSession()`.
2. Sets `window.location.href = "/login"`.

### 21.4 `PrivateRoute({ children })`

Purpose:

- Prevent access to protected pages when no token exists.

Flow:

1. Calls `loggedIn()`.
2. If no token, returns:

```jsx
<Navigate replace to="/login" />
```

3. Otherwise renders `children`.

### 21.5 Route Table

Frontend routes:

| Path | Component | Protected |
|---|---|---|
| `/login` | `Login` | No |
| `/` | `Dashboard` | Yes |
| `/hardware` | `HardwarePage` | Yes |
| `/software` | `SoftwarePage` | Yes |
| `/holders` | `HoldersPage` | Yes |
| `/issue` | `IssuePage` | Yes |
| `/take-back` | `TakeBackPage` | Yes |
| `/search` | `SearchPage` | Yes |
| `/stats` | `StatsPage` | Yes |
| `*` | redirect to `/` | Depends after redirect |

## 22. Frontend API Helper

Main file: `FRONTEND/src/api.js`.

### 22.1 `API_PREFIX`

```js
const API_PREFIX = import.meta.env.VITE_API_BASE_URL || "";
```

If `VITE_API_BASE_URL` is set, requests go there.

If empty, requests are relative. In Vite dev mode, `/api` is proxied to backend.

### 22.2 `authHeader()`

Purpose:

- Read JWT from `localStorage`.
- Return Authorization header if token exists.

Storage key:

```txt
eam_token
```

Return:

```js
{ Authorization: `Bearer ${token}` }
```

or:

```js
{}
```

### 22.3 `api(path, options = {})`

Main JSON request helper.

Flow:

1. Build headers:
   - `Accept: "application/json"`
   - auth header
   - any custom headers
2. Read `options.body`.
3. Detect JSON body:
   - object
   - not null
   - not `FormData`
4. If JSON body, set `Content-Type: application/json`.
5. Call `fetch()`.
6. Read response as text.
7. Try to parse JSON.
8. If parse fails:
   - detect HTML response
   - throw clear error if backend route is missing or backend is not running
9. If HTTP status is not OK:
   - throw `data.error` if available
10. Return parsed JSON.

Important behavior:

- JSON bodies are automatically stringified.
- `FormData` is not stringified.
- HTML API fallback pages no longer silently pass as data.

### 22.4 Session Helpers

#### `saveSession(token, user)`

Stores:

- `eam_token`
- `eam_user`

#### `clearSession()`

Removes:

- `eam_token`
- `eam_user`

#### `loadUser()`

Reads `eam_user`, parses JSON, returns user or `null`.

#### `loggedIn()`

Returns true when `eam_token` exists.

### 22.5 Excel Helpers

#### `downloadCategorySample(category)`

Calls:

```http
GET /api/import/samples/:category
```

Returns a `Blob`.

#### `uploadCategoryExcel(category, file)`

Creates `FormData`, appends file under field name `file`, then calls:

```http
POST /api/import/:category
```

Returns parsed JSON summary.

## 23. Vite Configuration

Main file: `FRONTEND/vite.config.js`.

### 23.1 Plugins

```js
plugins: [react(), tailwindcss()]
```

React plugin compiles JSX.

Tailwind plugin processes utility CSS.

### 23.2 Dev Server

```js
server: {
  port: 5173,
  proxy: {
    "/api": {
      target: "http://localhost:5000",
      changeOrigin: true
    }
  }
}
```

This means:

- Browser calls `http://127.0.0.1:5173/api/hardware`.
- Vite forwards request to `http://localhost:5000/api/hardware`.
- Frontend code can use relative `/api/...` paths.

## 24. Reusable Frontend Components

### 24.1 `ExcelUpload`

File: `FRONTEND/src/components/ExcelUpload.jsx`.

Props:

- `category`
- `sampleFile`
- `columnsHint`
- `onImported`

State:

- `file`
- `loading`
- `error`
- `result`

#### `downloadSample()`

Flow:

1. Clears error.
2. Calls `downloadCategorySample(category)`.
3. Creates object URL from blob.
4. Creates temporary anchor.
5. Sets anchor download filename.
6. Clicks anchor.
7. Revokes object URL.

#### `handleUpload(e)`

Flow:

1. Prevents default form submit.
2. Requires file selection.
3. Sets loading.
4. Calls `uploadCategoryExcel(category, file)`.
5. Stores result.
6. Clears selected file.
7. Resets form.
8. Calls `onImported(payload)` if provided.
9. Clears loading.

The component displays:

- category instructions
- sample download button
- file input
- upload button
- error messages
- import summary including inserted, updated, removed, skipped, and row errors.

### 24.2 `DropdownWithAdd`

File: `FRONTEND/src/components/DropdownWithAdd.jsx`.

Props:

- `label`
- `value`
- `onChange`
- `onAddNew`
- `options`
- `placeholder`
- `loading`
- `required`

State:

- `isOpen`
- `localOptions`
- `filteredOptions`

Current behavior:

- Typing filters options.
- Partial typed values are not automatically added.
- If typed value is not already in options, an `Add` button appears.
- New option is added only when the user clicks `Add`.
- Selecting an existing option fills the input and closes the menu.

Important functions:

#### `sameOption(a, b)`

Case-insensitive exact compare.

#### `uniqueOptions(values)`

Trims, removes blanks, removes duplicate values case-insensitively, sorts alphabetically.

#### `filterOptions(values, inputValue)`

Filters options by substring match.

#### `handleSelect(option)`

Selects existing option only.

#### `handleAdd()`

Adds new typed option only when:

- typed value is non-empty
- it does not already exist

Then:

1. Adds value to local options.
2. Calls `onAddNew` if supplied.
3. Calls `onChange`.
4. Closes dropdown.

## 25. Frontend Pages

### 25.1 Login Page

File: `FRONTEND/src/pages/Login.jsx`.

Purpose:

- Register or sign in app users.

State:

- `mode`: `login` or `register`
- `email`
- `password`
- `fullName`
- `error`
- `loading`

Initial redirect:

If `loggedIn()` and `loadUser()` both return truthy, redirects to `/`.

#### `submit(e)`

Flow:

1. Prevent form submit.
2. Clear error.
3. Set loading.
4. If mode is `register`, call:

```js
api("/api/auth/register", {
  method: "POST",
  body: { email, password, full_name: fullName }
})
```

5. If mode is `login`, call:

```js
api("/api/auth/login", {
  method: "POST",
  body: { email, password }
})
```

6. Save returned token/user through `saveSession`.
7. Redirect to `/`.
8. If error, show message.

### 25.2 Dashboard Page

File: `FRONTEND/src/pages/Dashboard.jsx`.

Purpose:

- Show operations overview, counts, recent hardware/software movement, and laptop report preview.

Initial API calls:

```js
Promise.all([
  api("/api/dashboard/activity"),
  api("/api/stats/summary"),
  api("/api/hardware?category=laptop")
])
```

State:

- `activity`
- `summary`
- `hwReport`
- `error`
- `loading`

Render sections:

- Summary cards for hardware/software/open assignments.
- Hardware movement list.
- Software movement list.
- Laptop report preview table.

### 25.3 People Page

File: `FRONTEND/src/pages/Holders.jsx`.

Purpose:

- Add and list people receiving assets.
- Import/remove people via Excel.

Initial call:

```js
api("/api/holders")
```

#### `refresh()`

Reloads holders and updates table.

#### `submit(e)`

Flow:

1. Prevent default.
2. Call:

```js
api("/api/holders", { method: "POST", body: form })
```

3. Reset form.
4. Refresh table.

ExcelUpload:

- category: `people`
- sample: `People.xlsx`

### 25.4 Hardware Page

File: `FRONTEND/src/pages/Hardware.jsx`.

Purpose:

- Add hardware with detailed legacy-style fields.
- Import/remove hardware.
- List hardware.
- Open hardware detail card.

State:

- `rows`
- `error`
- `categories`
- `models`
- `form`
- `showDetails`

#### `emptyForm`

Contains all fields used by the hardware form:

- asset identity
- dates
- status
- user assignment metadata
- comments

#### `refresh()`

Calls:

```js
api("/api/hardware")
```

#### `loadDropdownData()`

Calls:

```js
Promise.all([
  api("/api/dropdowns/hardware/categories"),
  api("/api/dropdowns/hardware/models")
])
```

#### `dropdowns`

Computed with `useMemo`.

It builds local dropdown option arrays from:

- backend dropdown endpoints
- existing hardware rows

Dropdown groups:

- platforms
- types
- makes
- models
- asset groups
- sources
- divisions
- places

#### `create(e)`

Flow:

1. Prevent default.
2. Build payload from form.
3. Set `category` to `form.platform || form.name`.
4. Set `notes` to `form.notes || form.comments`.
5. Call:

```js
api("/api/hardware", { method: "POST", body: payload })
```

6. Reset form.
7. Refresh rows.
8. Reload dropdown data.

#### `HardwareTable`

Displays:

- asset type
- make
- model
- status
- user
- division
- action button

Action button opens `HardwareDetails`.

#### `HardwareDetails`

Modal/card showing:

- platform
- asset type
- make
- model
- serial number
- asset tag
- asset number
- asset group
- source/contract
- purchase order
- status
- dates
- user fields
- field user address
- comments

### 25.5 Software Page

File: `FRONTEND/src/pages/Software.jsx`.

Purpose:

- Add software with vendor/platform/user fields.
- Track seats.
- Import/remove software.
- List software.
- Open detail card.

State:

- `rows`
- `error`
- `licenseTypes`
- `showDetails`
- `form`

#### `refresh()`

Calls:

```js
api("/api/software")
```

#### `loadLicenseTypes()`

Calls:

```js
api("/api/dropdowns/software/license-types")
```

#### `dropdowns`

Computed from rows and backend license types:

- platforms
- vendors
- licenseTypes
- statuses
- divisions
- locations

#### `create(e)`

Flow:

1. Prevent default.
2. Build payload.
3. Convert `total_licenses` and `seats_in_use` to numbers.
4. Set `notes` to `comments` if notes are empty.
5. Call:

```js
api("/api/software", { method: "POST", body: payload })
```

6. Reset form.
7. Refresh rows.
8. Reload license types.

#### `SoftwareDetails`

Modal/card showing:

- platform
- vendor
- license type
- seats
- purchase date
- status
- user/owner
- division
- location
- contract
- comments

### 25.6 Issue Page

File: `FRONTEND/src/pages/Issue.jsx`.

Purpose:

- Issue hardware or software to a person.
- Bulk import issue/return rows.

State:

- `holders`
- `hardwareList`
- `softwareList`
- `message`
- `error`
- `hwPayload`
- `swPayload`

#### `hydrate()`

Loads:

```js
Promise.all([
  api("/api/holders"),
  api("/api/hardware"),
  api("/api/software")
])
```

Then:

- stores holders
- filters hardware to `status === "AVAILABLE"`
- stores software list

#### `issueHardware(e)`

Flow:

1. Prevent default.
2. Call:

```js
api("/api/assignments/issue-hardware", {
  method: "POST",
  body: {
    holder_id: Number(hwPayload.holder_id),
    hardware_id: Number(hwPayload.hardware_id),
    notes: hwPayload.notes || null
  }
})
```

3. Show success message.
4. Reset form.
5. Rehydrate lists.

#### `issueSoftware(e)`

Flow:

1. Prevent default.
2. Call:

```js
api("/api/assignments/issue-software", {
  method: "POST",
  body: {
    holder_id: Number(swPayload.holder_id),
    software_id: Number(swPayload.software_id),
    notes: swPayload.notes || null
  }
})
```

3. Show success message.
4. Reset form.
5. Rehydrate lists.

### 25.7 Take Back Page

File: `FRONTEND/src/pages/TakeBack.jsx`.

Purpose:

- List open assignments.
- Process returns.
- Bulk import returns through Excel.

State:

- `open`
- `error`
- `message`

#### `refresh()`

Calls:

```js
api("/api/assignments/open")
```

#### `handleReturn(id)`

Flow:

1. Call:

```js
api(`/api/assignments/${id}/take-back`, { method: "POST" })
```

2. Show message.
3. Refresh open assignments.

### 25.8 Search Page

File: `FRONTEND/src/pages/Search.jsx`.

Purpose:

- Search hardware and software catalog.

State:

- `term`
- `rows`
- `error`

Behavior:

- If input is empty, clear rows.
- Otherwise wait 300 ms before searching.
- Calls:

```js
api(`/api/search?q=${encodeURIComponent(term.trim())}`)
```

Results show:

- kind
- name
- detail
- link to manage in hardware/software module.

### 25.9 Stats Page

File: `FRONTEND/src/pages/Stats.jsx`.

Purpose:

- Show metrics, currently issued people/assets table, detail card, contract summaries.

Initial calls:

```js
Promise.all([
  api("/api/stats/contracts"),
  api("/api/hardware"),
  api("/api/software"),
  api("/api/assignments/open")
])
```

State:

- `contracts`
- `hardware`
- `software`
- `assignments`
- `selected`
- `error`

#### `metrics`

Computed with `useMemo`.

Calculates:

- total hardware
- total software
- active assignments
- used license seats
- total license seats

#### Main issued table

Rows come from `/api/assignments/open`.

Columns:

- employee
- division
- asset
- type
- issued date
- action

`View` opens `AssignmentCard`.

#### `AssignmentCard`

Shows:

- employee info
- issued item info
- notes

#### Contract tables

Uses data from `/api/stats/contracts`.

Tables:

- open assignments by contract
- hardware by contract
- software seats by contract

## 26. End-to-End Workflows

### 26.1 Login Workflow

1. User visits `/login`.
2. User enters email/password.
3. `Login.submit()` calls `/api/auth/login`.
4. Backend selects user by email.
5. Backend compares password with `bcrypt`.
6. Backend signs JWT.
7. Frontend stores token with `saveSession()`.
8. Browser redirects to `/`.
9. `PrivateRoute` sees token and allows dashboard.

### 26.2 Register Workflow

1. User switches login page to create account.
2. User submits full name, email, password.
3. Frontend calls `/api/auth/register`.
4. Backend hashes password.
5. Backend inserts into `eam_app_user`.
6. Backend returns JWT.
7. Frontend stores JWT and user.
8. Browser redirects to dashboard.

### 26.3 Add Person Workflow

1. User opens `/holders`.
2. Page calls `GET /api/holders`.
3. User fills person form.
4. `submit()` calls `POST /api/holders`.
5. Backend validates `full_name`.
6. Backend inserts holder.
7. Backend commits.
8. Frontend refreshes list.

### 26.4 Add Hardware Workflow

1. User opens `/hardware`.
2. Page loads all hardware.
3. Page loads hardware dropdown data.
4. User fills form.
5. User may type dropdown values.
6. New dropdown values are saved locally only when user clicks `Add`.
7. Submit calls `POST /api/hardware`.
8. Backend validates `asset_tag` and `name`.
9. Backend packs extra fields into `notes`.
10. Backend inserts row.
11. Backend commits.
12. Frontend refreshes table and dropdown data.

### 26.5 Add Software Workflow

1. User opens `/software`.
2. Page loads all software.
3. Page loads license type dropdown data.
4. User fills form.
5. Submit calls `POST /api/software`.
6. Backend validates `name`.
7. Backend packs extra fields into `notes`.
8. Backend inserts software row.
9. Backend commits.
10. Frontend refreshes table.

### 26.6 Issue Hardware Workflow

1. User opens `/issue`.
2. Page loads holders, hardware, software.
3. Hardware list is filtered to available hardware only.
4. User selects holder and hardware.
5. Frontend calls `/api/assignments/issue-hardware`.
6. Backend verifies JWT and gets `issuedBy`.
7. Backend locks hardware row with `FOR UPDATE`.
8. Backend verifies hardware is `AVAILABLE`.
9. Backend checks no duplicate open assignment exists.
10. Backend inserts assignment.
11. Backend updates hardware status to `ISSUED`.
12. Backend commits.
13. Frontend shows success and reloads lists.

### 26.7 Issue Software Workflow

1. User opens `/issue`.
2. User selects holder and software.
3. Frontend calls `/api/assignments/issue-software`.
4. Backend locks software row.
5. Backend verifies seats are available.
6. Backend inserts assignment.
7. Backend increments `seats_in_use`.
8. Backend commits.
9. Frontend shows success and reloads lists.

### 26.8 Take Back Workflow

1. User opens `/take-back`.
2. Page calls `/api/assignments/open`.
3. User clicks `Process return`.
4. Frontend calls `/api/assignments/:id/take-back`.
5. Backend locks open assignment.
6. Backend sets `returned_at`.
7. If hardware, backend sets hardware status to `AVAILABLE`.
8. If software, backend decrements seats.
9. Backend commits.
10. Frontend refreshes open assignments.

### 26.9 Stats View Workflow

1. User opens `/stats`.
2. Frontend calls four APIs in parallel:
   - contracts stats
   - hardware
   - software
   - open assignments
3. Frontend computes summary metrics.
4. Frontend renders issued people/assets table.
5. User clicks `View`.
6. Frontend opens assignment detail card.

### 26.10 Excel Import Workflow

1. User opens a page with `ExcelUpload`.
2. User downloads sample file if needed.
3. User selects Excel file.
4. `ExcelUpload.handleUpload()` sends `FormData` to `/api/import/:category`.
5. Backend `multer` validates upload.
6. Backend parses workbook with `xlsx`.
7. Headers are normalized.
8. Rows are converted to canonical fields.
9. Category-specific import handler processes each row.
10. Backend commits once.
11. Frontend displays inserted/updated/removed/skipped/errors.
12. Parent page refreshes data.

## 27. Error Handling Patterns

### 27.1 Backend

Common behavior:

- Validate input early.
- Return `400` for missing required fields.
- Return `401` for auth failures.
- Return `404` for missing records.
- Return `409` for conflicts like duplicate asset or unavailable hardware.
- Return `500` for unexpected server errors.

### 27.2 Frontend

Each page usually stores:

- `error`
- sometimes `message`
- sometimes `loading`

The API helper throws JavaScript `Error` objects. Pages catch them and display `err.message`.

### 27.3 HTML Instead of JSON Error

The API helper detects when a request expected JSON but got HTML, for example:

- backend not running
- route does not exist
- Vite served `index.html`

It throws:

```txt
API returned an HTML page. Check that the backend is running and the API route exists.
```

This fixed the previous Stats issue caused by calling an incorrect route.

## 28. Security Notes

Current security mechanisms:

- Passwords are hashed with bcrypt.
- JWT protects backend routes.
- JWT expires after 30 days.
- Protected routes require `Authorization: Bearer`.
- SQL uses bind parameters.
- Excel upload validates extension/MIME and size.

Important considerations:

- Store `JWT_SECRET` securely.
- Do not commit `.env`.
- Use HTTPS in production.
- Consider stricter CORS origins for production.
- Add role-based access if admins and normal users should differ.

## 29. Running the Application

### 29.1 Backend

From `BACKEND/`:

```bash
npm install
npm run start
```

or for development:

```bash
npm run dev
```

Backend default:

```txt
http://localhost:5000
```

### 29.2 Frontend

From `FRONTEND/`:

```bash
npm install
npm run dev
```

Frontend default:

```txt
http://127.0.0.1:5173
```

### 29.3 Build Frontend

```bash
npm run build
```

This creates `FRONTEND/dist/`.

## 30. Database Setup Summary

The `database/` folder contains setup scripts.

### 30.1 Create Schema User

File:

```txt
database/00_create_eam_schema_user.sql
```

Purpose:

- Create Oracle user `eam`.
- Grant `CONNECT` and `RESOURCE`.
- Grant quota on `USERS`.

### 30.2 Create Tables

File:

```txt
database/01_schema.sql
```

Purpose:

- Create EAM tables and database objects.

### 30.3 Seed Sample Data

File:

```txt
database/02_seed_sample.sql
```

Seed examples:

- Ada Lovelace holder.
- Alan Turing holder.
- sample laptops and monitor.
- Adobe Creative Cloud.
- Microsoft 365 E3.

### 30.4 Reference Queries

File:

```txt
database/03_queries_reference.sql
```

Includes examples for:

- list laptops
- current open assignments
- recent returns
- global search
- stats by contract
- issue transaction pattern
- take-back transaction pattern

## 31. Troubleshooting

### 31.1 Stats Page Shows HTML/JSON Error

Likely causes:

- backend is not running
- frontend is not proxying `/api`
- route URL is wrong

Check:

```txt
http://localhost:5000/api/health
```

Expected:

```json
{ "ok": true, "service": "eam-backend" }
```

### 31.2 Login Fails With Invalid Token Later

Possible causes:

- `JWT_SECRET` changed after token was created.
- Token expired.
- Browser has old token.

Fix:

- Sign out.
- Clear browser localStorage keys `eam_token` and `eam_user`.
- Log in again.

### 31.3 Hardware Cannot Be Issued

Possible causes:

- hardware status is not `AVAILABLE`.
- hardware already has an open assignment.

Backend protects this with:

- row lock
- status check
- duplicate open assignment count

### 31.4 Software Cannot Be Issued

Possible causes:

- `seats_in_use >= total_licenses`
- software row does not exist

If `total_licenses` is `0`, the backend treats it as unlimited because the cap check is:

```js
if (total > 0 && used >= total)
```

### 31.5 Dropdown Adds Partial Words

Fixed behavior:

- typing filters only
- option is added only when `Add` is clicked

If partial words still show:

- reload frontend dev server
- clear browser cache if needed
- ensure the updated `DropdownWithAdd.jsx` is running

## 32. Important Implementation Details and Design Decisions

### 32.1 Extra Form Fields Stored in `notes`

The hardware/software forms contain more fields than the original compact database tables.

Instead of requiring immediate database migration, extra fields are serialized into `notes`.

Benefits:

- Works without Oracle schema change.
- Existing rows with plain notes still work.
- New UI can display richer cards.

Tradeoff:

- Extra fields are not normal database columns.
- Searching/filtering by extra fields in SQL is not straightforward.
- A future migration could create explicit columns and migrate the JSON data.

### 32.2 Assignment Transactions Use Row Locks

The assignment routes use `FOR UPDATE` when issuing or returning.

This prevents two users from issuing the same hardware or same software seat at the same moment.

### 32.3 Frontend Uses Local State, Not Global Store

There is no Redux or global state library.

Each page:

- loads its own data
- stores it in `useState`
- refreshes after mutations

This keeps the app simple and easy to reason about.

### 32.4 Vite Proxy Keeps API Calls Clean

Frontend code calls `/api/...`.

In development, Vite proxies those requests to Express.

This avoids hard-coding `http://localhost:5000` inside every component.

## 33. File Inventory by Responsibility

### Backend

```txt
BACKEND/src/server.js
```

Creates Express server, mounts middleware/routes, starts Oracle pool.

```txt
BACKEND/src/db.js
```

Oracle pool and connection helper.

```txt
BACKEND/src/util.js
```

Converts Oracle rows to frontend JSON shape.

```txt
BACKEND/src/middleware/auth.js
```

JWT verification middleware.

```txt
BACKEND/src/routes/auth.js
```

Register and login.

```txt
BACKEND/src/routes/holders.js
```

People/holders list and create.

```txt
BACKEND/src/routes/hardware.js
```

Hardware list, detail, create, extra-field packing.

```txt
BACKEND/src/routes/software.js
```

Software list, detail, create, extra-field packing.

```txt
BACKEND/src/routes/assignments.js
```

Open assignments, issue hardware, issue software, take back.

```txt
BACKEND/src/routes/dashboard.js
```

Recent activity feeds.

```txt
BACKEND/src/routes/stats.js
```

Summary and contract metrics.

```txt
BACKEND/src/routes/search.js
```

Unified hardware/software search.

```txt
BACKEND/src/routes/dropdowns.js
```

Distinct dropdown option endpoints.

```txt
BACKEND/src/routes/import.js
```

Excel sample downloads and upload endpoints.

```txt
BACKEND/src/services/excelParser.js
```

Workbook/header/cell parsing.

```txt
BACKEND/src/services/excelImport.js
```

Category import handlers and issue/return import transactions.

### Frontend

```txt
FRONTEND/src/main.jsx
```

React entrypoint.

```txt
FRONTEND/src/App.jsx
```

Routes, layout, private route guard.

```txt
FRONTEND/src/api.js
```

Fetch wrapper, auth/session helpers, Excel helpers.

```txt
FRONTEND/src/components/ExcelUpload.jsx
```

Reusable Excel import UI.

```txt
FRONTEND/src/components/DropdownWithAdd.jsx
```

Searchable dropdown with explicit Add button.

```txt
FRONTEND/src/pages/Login.jsx
```

Login/register UI.

```txt
FRONTEND/src/pages/Dashboard.jsx
```

Operations overview.

```txt
FRONTEND/src/pages/Holders.jsx
```

People receiving assets.

```txt
FRONTEND/src/pages/Hardware.jsx
```

Hardware inventory form/table/detail card.

```txt
FRONTEND/src/pages/Software.jsx
```

Software inventory form/table/detail card.

```txt
FRONTEND/src/pages/Issue.jsx
```

Issue hardware/software.

```txt
FRONTEND/src/pages/TakeBack.jsx
```

Return issued assets.

```txt
FRONTEND/src/pages/Search.jsx
```

Unified catalog search.

```txt
FRONTEND/src/pages/Stats.jsx
```

Stats, current issued table, employee/asset detail cards.

## 34. Current Verified State

Recent verification performed:

```bash
npm run build
```

from `FRONTEND/` completed successfully after the latest dropdown behavior fix.

Backend syntax checks were also previously run for changed backend route files:

```bash
node --check src/routes/hardware.js
node --check src/routes/software.js
node --check src/routes/assignments.js
```

Those checks passed.

## 35. Suggested Future Improvements

These are not required for current operation, but they would make the system stronger:

1. Add explicit Oracle columns for extra hardware/software fields instead of storing them in `notes`.
2. Add backend update/delete routes for hardware/software/person rows from the React UI.
3. Add role-based authorization, for example admin versus normal user.
4. Add automated tests for assignment transactions.
5. Add pagination for large hardware/software tables.
6. Add server-side search filters for status, division, platform, vendor, and contract.
7. Add import preview before committing Excel changes.
8. Add audit logs for create/update/delete actions.
9. Add production build serving strategy, either static hosting for frontend or Express static serving.
10. Add stricter CORS config for production.

