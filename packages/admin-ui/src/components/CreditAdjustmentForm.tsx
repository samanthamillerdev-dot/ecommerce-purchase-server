import { Button, NumberField, Panel, Text, TextField } from "@clickhouse/click-ui";
import { useState } from "react";
import { deductCredit, grantCredit } from "../api/client";

interface Props {
  customerId: string;
  onAdjusted: () => void;
}

export function CreditAdjustmentForm({ customerId, onAdjusted }: Props): JSX.Element {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = Number(amount);
  const canSubmit = amount.trim() !== "" && parsedAmount > 0 && reason.trim() !== "" && !submitting;

  const submit = async (action: "grant" | "deduct") => {
    setSubmitting(true);
    setError(null);
    try {
      if (action === "grant") {
        await grantCredit(customerId, parsedAmount, reason);
      } else {
        await deductCredit(customerId, parsedAmount, reason);
      }
      setAmount("");
      setReason("");
      onAdjusted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel padding="sm" color="muted" orientation="vertical" gap="sm">
      <Panel orientation="horizontal" gap="sm" alignItems="end">
        <NumberField label="Amount" value={amount} onChange={setAmount} />
        <TextField label="Reason" value={reason} onChange={setReason} placeholder="Why is this adjustment happening?" />
        <Button label="Grant" type="primary" disabled={!canSubmit} onClick={() => submit("grant")} />
        <Button label="Deduct" type="secondary" disabled={!canSubmit} onClick={() => submit("deduct")} />
      </Panel>
      {error && (
        <Text color="danger" size="sm">
          {error}
        </Text>
      )}
    </Panel>
  );
}
