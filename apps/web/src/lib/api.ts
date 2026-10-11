import createClient from "openapi-fetch";
import type { paths } from "@/types/api";

export const api = createClient<paths>();
