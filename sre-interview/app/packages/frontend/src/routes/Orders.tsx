import { useCallback } from "react";
import { fetchOrders } from "../api.js";
import { usePaging } from "../paging.js";
import { Pager, TableState, shortId, time } from "../table.js";
import { usePolled } from "../usePolled.js";

export function Orders() {
  const { page, offset, setPage } = usePaging();
  const load = useCallback(() => fetchOrders(offset), [offset]);
  const { data, error } = usePolled(load, "orders", page === 1);

  return (
    <section>
      <h2>
        Orders <span className="count">{data ? `${data.total} rows` : ""}</span>
      </h2>
      <TableState page={data} error={error} label="orders">
        <table>
          <thead>
            <tr>
              <th>External id</th>
              <th>Customer</th>
              <th style={{ textAlign: "right" }}>Value</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((order) => (
              <tr key={order.id}>
                <td className="mono">{shortId(order.externalId)}</td>
                <td>
                  {order.customerId ? (
                    [order.customerFirstName, order.customerLastName]
                      .filter(Boolean)
                      .join(" ") || shortId(order.customerId)
                  ) : (
                    <span className="unlinked">not linked</span>
                  )}
                </td>
                <td className="numeric">{order.value ?? "—"}</td>
                <td>{time(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableState>
      {data && data.total > 0 && <Pager page={data} onPage={setPage} />}
    </section>
  );
}
