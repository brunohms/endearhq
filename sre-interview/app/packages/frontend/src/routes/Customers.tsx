import { useCallback } from "react";
import { fetchCustomers } from "../api.js";
import { usePaging } from "../paging.js";
import { Pager, TableState, shortId, time } from "../table.js";
import { usePolled } from "../usePolled.js";

export function Customers() {
  const { page, offset, setPage } = usePaging();
  const load = useCallback(() => fetchCustomers(offset), [offset]);
  const { data, error } = usePolled(load, "customers", page === 1);

  return (
    <section>
      <h2>
        Customers <span className="count">{data ? `${data.total} rows` : ""}</span>
      </h2>
      <TableState page={data} error={error} label="customers">
        <table>
          <thead>
            <tr>
              <th>External id</th>
              <th>First name</th>
              <th>Last name</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((customer) => (
              <tr key={customer.id}>
                <td className="mono">{shortId(customer.externalId)}</td>
                <td>{customer.firstName ?? "—"}</td>
                <td>{customer.lastName ?? "—"}</td>
                <td>{time(customer.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableState>
      {data && data.total > 0 && <Pager page={data} onPage={setPage} />}
    </section>
  );
}
