import type { Customer, Order, Page } from "./types.js";

export const PAGE_SIZE = 25;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

const paged = (path: string, offset: number) =>
  `${path}?limit=${PAGE_SIZE}&offset=${offset}`;

export const fetchCustomers = (offset: number) =>
  getJson<Page<Customer>>(paged("/api/customers", offset));

export const fetchOrders = (offset: number) =>
  getJson<Page<Order>>(paged("/api/orders", offset));
