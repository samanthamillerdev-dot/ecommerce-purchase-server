import { Button, Panel, Table, Text, TextField, Title } from "@clickhouse/click-ui";
import { useEffect, useState } from "react";
import { AdminCustomerSummary, listCustomers } from "../api/client";

interface Props {
  selectedCustomerId: string | null;
  onSelectCustomer: (customerId: string) => void;
  /** Bump this to force the customer list to refetch (e.g. after a credit or refund change). */
  refreshToken: number;
}

export function CustomerSearch({ selectedCustomerId, onSelectCustomer, refreshToken }: Props): JSX.Element {
  const [customers, setCustomers] = useState<AdminCustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualCustomerId, setManualCustomerId] = useState("");

  useEffect(() => {
    listCustomers()
      .then(setCustomers)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshToken]);

  return (
    <Panel padding="md" hasBorder orientation="vertical" gap="sm">
      <Title type="h2" size="sm">
        Customers
      </Title>
      <Text size="sm" color="muted">
        Known customers are ones with at least one purchase or credit event on file. Jump straight to a customer by ID if
        they're new.
      </Text>
      <Panel orientation="horizontal" gap="sm" alignItems="end">
        <TextField
          label="Customer ID"
          placeholder="e.g. 11111111-1111-4111-8111-111111111111"
          value={manualCustomerId}
          onChange={setManualCustomerId}
        />
        <Button
          label="Open"
          type="secondary"
          disabled={!manualCustomerId.trim()}
          onClick={() => onSelectCustomer(manualCustomerId.trim())}
        />
      </Panel>
      {error && (
        <Text color="danger" size="sm">
          {error}
        </Text>
      )}
      <Table
        loading={loading}
        noDataMessage="No customers with purchase or credit history yet"
        headers={[{ label: "Name" }, { label: "Email" }, { label: "Balance" }]}
        rows={customers.map((customer) => ({
          id: customer.customerId,
          isActive: customer.customerId === selectedCustomerId,
          onClick: () => onSelectCustomer(customer.customerId),
          style: { cursor: "pointer" },
          items: [{ label: customer.name }, { label: customer.email }, { label: `$${customer.balance.toFixed(2)}` }]
        }))}
      />
    </Panel>
  );
}
