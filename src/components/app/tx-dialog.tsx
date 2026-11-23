"use client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Category, Transaction } from "@/lib/types";
import { emptyForm, formFromTx, TransactionForm } from "./transaction-form";

/** Add / edit a transaction in a dialog (bottom sheet on mobile). */
export function TransactionDialog({
  open,
  onOpenChange,
  categories,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: Category[];
  editing?: Transaction | null;
  onSaved: (t: Transaction) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editing ? "แก้ไขรายการ" : "เพิ่มรายการ"}>
        {open && (
          <TransactionForm
            key={editing?.id ?? "new"}
            categories={categories}
            initial={editing ? formFromTx(editing) : emptyForm()}
            editId={editing?.id}
            onSaved={(t) => {
              onSaved(t);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
