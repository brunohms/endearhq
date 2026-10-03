export interface Page<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Customer {
  id: string;
  externalId: string;
  firstName: string | null;
  lastName: string | null;
  data: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  externalId: string;
  customerId: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  value: string | null;
  data: unknown;
  createdAt: string;
  updatedAt: string;
}
