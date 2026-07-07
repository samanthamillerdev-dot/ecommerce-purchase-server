import { Button, NumberField, Panel, Text, TextField } from "@clickhouse/click-ui";
import { useState } from "react";
import { Purchase, refundPurchase } from "../api/client";

interface Props {
  purchase: Purchase;
  onDone: () => void;
}

export function RefundForm({ purchase, onDone }: Props): JSX.Element {
  const remainingQuantity = purchase.quantity - purchase.refundedQuantity;
  const [quantity, setQuantity] = useState(String(remainingQuantity));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedQuantity = Number(quantity);
  const canSubmit = Number.isInteger(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= remainingQuantity && !submitting;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await refundPurchase(purchase.id, { quantity: parsedQuantity, reason: reason || undefined });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel padding="sm" hasBorder orientation="vertical" gap="sm">
      <Text size="sm" weight="semibold">
        Refund {purchase.sku} ({remainingQuantity} of {purchase.quantity} unrefunded)
      </Text>
      <Panel orientation="horizontal" gap="sm" alignItems="end">
        <NumberField label="Quantity to refund" value={quantity} onChange={setQuantity} max={remainingQuantity} min={1} />
        <TextField label="Reason" value={reason} onChange={setReason} placeholder="Optional" />
        <Button label="Confirm refund" type="danger" disabled={!canSubmit} onClick={submit} />
      </Panel>
      {error && (
        <Text color="danger" size="sm">
          {error}
        </Text>
      )}
    </Panel>
  );
}
