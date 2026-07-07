import { Panel, Table, Text, Title } from "@clickhouse/click-ui";
import { useCallback, useEffect, useState } from "react";
import { AdminCustomerDetail, getCustomerDetail } from "../api/client";
import { CreditAdjustmentForm } from "./CreditAdjustmentForm";
import { RefundForm } from "./RefundForm";

interface Props {
  customerId: string;
  onChanged: () => void;
}

export function CustomerDetail({ customerId, onChanged }: Props): JSX.Element {
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundingPurchaseId, setRefundingPurchaseId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    getCustomerDetail(customerId)
      .then((d) => {
        setDetail(d);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [customerId]);

  useEffect(() => {
    setRefundingPurchaseId(null);
    reload();
  }, [reload]);

  if (error) {
    return (
      <Panel padding="md" hasBorder>
        <Text color="danger">{error}</Text>
      </Panel>
    );
  }

  if (loading || !detail) {
    return (
      <Panel padding="md" hasBorder>
        <Text color="muted">Loading customer...</Text>
      </Panel>
    );
  }

  const refundingPurchase = detail.purchases.find((p) => p.id === refundingPurchaseId) ?? null;

  return (
    <Panel padding="md" hasBorder orientation="vertical" gap="md">
      <Panel orientation="horizontal" gap="lg">
        <Panel orientation="vertical" gap="xs">
          <Title type="h2" size="sm">
            {detail.customer.name}
          </Title>
          <Text size="sm" color="muted">
            {detail.customer.email}
          </Text>
        </Panel>
        <Panel orientation="vertical" gap="xs">
          <Text size="sm" color="muted">
            Credit balance
          </Text>
          <Title type="h2" size="sm">
            ${detail.balance.toFixed(2)}
          </Title>
        </Panel>
      </Panel>

      <CreditAdjustmentForm
        customerId={customerId}
        onAdjusted={() => {
          reload();
          onChanged();
        }}
      />

      <Title type="h3" size="xs">
        Purchases
      </Title>
      <Table
        noDataMessage="No purchases yet"
        headers={[
          { label: "Date" },
          { label: "SKU" },
          { label: "Qty" },
          { label: "Total" },
          { label: "Status" },
          { label: "" }
        ]}
        rows={detail.purchases.map((purchase) => ({
          id: purchase.id,
          items: [
            { label: new Date(purchase.createdAt).toLocaleString() },
            { label: purchase.sku },
            { label: String(purchase.quantity) },
            { label: `$${purchase.totalPrice.toFixed(2)}` },
            { label: purchase.status },
            {
              label:
                purchase.status === "REFUNDED" ? (
                  ""
                ) : (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setRefundingPurchaseId(purchase.id === refundingPurchaseId ? null : purchase.id);
                    }}
                  >
                    Refund
                  </a>
                )
            }
          ]
        }))}
      />

      {refundingPurchase && (
        <RefundForm
          purchase={refundingPurchase}
          onDone={() => {
            setRefundingPurchaseId(null);
            reload();
            onChanged();
          }}
        />
      )}

      <Title type="h3" size="xs">
        Credit history
      </Title>
      <Table
        noDataMessage="No credit activity yet"
        headers={[{ label: "Date" }, { label: "Type" }, { label: "Amount" }, { label: "Balance after" }, { label: "Reason" }]}
        rows={detail.ledger.map((entry) => ({
          id: entry.id,
          items: [
            { label: new Date(entry.createdAt).toLocaleString() },
            { label: entry.type },
            { label: `${entry.amount >= 0 ? "+" : ""}$${entry.amount.toFixed(2)}` },
            { label: `$${entry.balanceAfter.toFixed(2)}` },
            { label: entry.reason }
          ]
        }))}
      />
    </Panel>
  );
}
