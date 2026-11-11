// Vercel entry point: the whole Express API as one serverless function (region hnd1, Tokyo, next to the database).
// vercel.json rewrites every /api/* request here; Express sees the original path.
// The server is compiled to server/dist by the build command first.
import { app } from '../server/dist/index.js'

export default app
