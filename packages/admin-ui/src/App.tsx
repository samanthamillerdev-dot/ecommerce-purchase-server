import { Panel, Spacer, Title } from "@clickhouse/click-ui";
import { useState } from "react";
import { CustomerDetail } from "./components/CustomerDetail";
import { CustomerSearch } from "./components/CustomerSearch";

export function App(): JSX.Element {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerListVersion, setCustomerListVersion] = useState(0);

  return (
    <Panel padding="lg" orientation="vertical" gap="md">
      <Title type="h1" size="lg">
        Customer Service Console
      </Title>
      <CustomerSearch
        selectedCustomerId={selectedCustomerId}
        onSelectCustomer={setSelectedCustomerId}
        refreshToken={customerListVersion}
      />
      <Spacer size="md" />
      {selectedCustomerId && (
        <CustomerDetail customerId={selectedCustomerId} onChanged={() => setCustomerListVersion((v) => v + 1)} />
      )}
    </Panel>
  );
}
