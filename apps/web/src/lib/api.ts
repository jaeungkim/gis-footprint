import createClient from "openapi-fetch";
import type { paths } from "./schema";

// Relative paths go through the Next rewrite to Nest, so this works in the
// browser only. Server code needs an absolute baseUrl.
export const api = createClient<paths>();
