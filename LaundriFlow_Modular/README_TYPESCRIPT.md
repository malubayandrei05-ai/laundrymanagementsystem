# LaundriFlow Modular — TypeScript Conversion

This archive preserves the existing frontend screens, styles, routes, database schema, and project progress. The frontend was already written in TypeScript/TSX and is retained as-is. The backend JavaScript source files have been converted to TypeScript.

## Backend
- Backend source files are now `.ts` (server, routes, controllers, middleware, config).
- `backend/tsconfig.json` compiles into `backend/dist`.
- Run development server: `cd backend` then `npm install` then `npm run dev`.
- Build: `npm run build`; production start: `npm start`.

## Frontend
- Existing React/Vite TypeScript files and CSS are preserved.
- Run: `cd frontend` then `npm install` then `npm run dev`.

## Database
Import `backend/database/schema.sql` into the same MySQL database used by the original project. Configure `backend/.env` using `.env.example`.

## Notes
Dependencies/node_modules are intentionally excluded from the archive to keep it portable and avoid bundled platform-specific packages. Run `npm install` separately inside backend and frontend.
