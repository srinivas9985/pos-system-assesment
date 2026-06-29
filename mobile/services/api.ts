import { API_URL, PAGE_SIZE } from '@/constants/config';
import type { Cart, Category, Order, Product, ProductsResponse, SyncResponse, Tag, VersionConflictError } from '@/types';

function encodeListCursor(id: number): string {
  const padded = String(Math.max(0, id - 1)).padStart(10, '0');
  return globalThis.btoa(padded);
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async parseBumpResponse(
    res: Response
  ): Promise<{ id: number; version: number }> {
    if (res.status === 409) {
      const body = await res.json();
      const err = new Error('version_conflict') as VersionConflictError;
      err.status = 409;
      err.currentVersion = body.current_version;
      throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async getProducts(cursor?: string, limit = PAGE_SIZE): Promise<ProductsResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('after', cursor);
    const res = await fetch(`${this.baseUrl}/products?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  /**
   * Server-side search when backend supports `GET /products?search=...`.
   * Returns null if the backend ignores the param (no `search_applied` in response).
   * Results are persisted via `upsertProductsCache` — no cache-layer changes needed when API goes live.
   */
  async searchProducts(query: string, limit = PAGE_SIZE): Promise<Product[] | null> {
    const params = new URLSearchParams({
      search: query.trim(),
      limit: String(limit),
    });
    const res = await fetch(`${this.baseUrl}/products?${params}`);
    if (!res.ok) return null;
    const body: ProductsResponse = await res.json();
    if (!body.search_applied) return null;
    return body.data ?? [];
  }

  async getProduct(id: number): Promise<Product> {
    const params = new URLSearchParams({
      limit: '1',
      after: encodeListCursor(id),
    });
    const res = await fetch(`${this.baseUrl}/products?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body: ProductsResponse = await res.json();
    const product = body.data[0];
    if (!product || product.id !== id) throw new Error('Product not found');
    return product;
  }

  async bumpProduct(id: number, expectedVersion: number): Promise<{ id: number; version: number }> {
    const res = await fetch(`${this.baseUrl}/products/${id}/bump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: expectedVersion }),
    });
    return this.parseBumpResponse(res);
  }

  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${this.baseUrl}/categories`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async bumpCategory(id: number, expectedVersion: number): Promise<{ id: number; version: number }> {
    const res = await fetch(`${this.baseUrl}/categories/${id}/bump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: expectedVersion }),
    });
    return this.parseBumpResponse(res);
  }

  async getTags(): Promise<Tag[]> {
    const res = await fetch(`${this.baseUrl}/tags`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async bumpTag(id: number, expectedVersion: number): Promise<{ id: number; version: number }> {
    const res = await fetch(`${this.baseUrl}/tags/${id}/bump`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expected_version: expectedVersion }),
    });
    return this.parseBumpResponse(res);
  }

  private async parseError(res: Response): Promise<string> {
    try {
      const body = await res.json();
      if (body?.error) return String(body.error);
    } catch {
      // ignore parse errors
    }
    return `HTTP ${res.status}`;
  }

  async cartAction(payload: {
    action: 'add' | 'remove' | 'update' | 'list';
    product_id?: number;
    quantity?: number;
    note?: string;
    scheduled_delivery?: string;
    device_id: string;
  }): Promise<Cart> {
    const res = await fetch(`${this.baseUrl}/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await this.parseError(res));
    return res.json();
  }

  async createOrder(deviceId: string): Promise<Order> {
    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId }),
    });
    if (!res.ok) throw new Error(await this.parseError(res));
    return res.json();
  }

  async getOrders(deviceId?: string): Promise<Order[]> {
    const url = deviceId
      ? `${this.baseUrl}/orders?device_id=${deviceId}`
      : `${this.baseUrl}/orders`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async payOrder(orderId: number): Promise<{ order_id: number; payment_status: string; order_status: string }> {
    const res = await fetch(`${this.baseUrl}/orders/${orderId}/pay`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async getSync(since: number): Promise<SyncResponse> {
    const res = await fetch(`${this.baseUrl}/sync?since=${since}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}

export const api = new ApiClient(API_URL);

export type { Cart } from '@/types';
