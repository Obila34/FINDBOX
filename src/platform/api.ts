export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers:
        body === undefined
          ? {}
          : { "Content-Type": "application/json", "X-FindBox-Request": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError(
      0,
      "Cannot reach FindBox. Check your connection and try again.",
    );
  }
  const data = await response
    .json()
    .catch(() => ({ error: "FindBox server is not connected yet." }));
  if (!response.ok)
    throw new ApiError(response.status, data.error || "Please try again.");
  return data as T;
}
export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  verified: boolean;
  school_id: string;
};
export type Product = {
  id: string;
  name: string;
  description: string;
  price_minor: number;
  tag_count: number;
  format: string;
  image: string;
};
export type Item = {
  id: string;
  code: string;
  name: string;
  category: string;
  color: string;
  child_name: string;
  status: string;
};
export type Recovery = {
  id: string;
  title: string;
  category: string;
  status: string;
  box_id: string;
  box_name: string;
  due_at: string | null;
  item_id: string | null;
  private_note?: string;
};
export type Box = {
  id: string;
  name: string;
  directions: string;
  opening_hours: string;
};
export type Workspace = {
  children: { id: string; name: string }[];
  user: User;
  school: { name: string; collection_days: number };
  items: Item[];
  cases: Recovery[];
  boxes: Box[];
  tags: { id: string; code: string; status: string; format: string }[];
  orders: {
    id: string;
    amount_minor: number;
    status: string;
    created_at: string;
    payment_method?: string;
    lines: { name: string; quantity: number }[];
  }[];
  notifications: { id: string; message: string; read_at: string | null }[];
  claims: { id: string; case_id: string; status: string; evidence: string }[];
  checkins: { day: string }[];
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n / 100);
