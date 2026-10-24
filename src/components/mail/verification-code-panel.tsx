"use client";

import { Check, Copy, Eye } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface VerificationCodePanelProps {
  code: string;
  onViewOriginal?: () => void;
}

export function VerificationCodePanel({
  code,
  onViewOriginal,
}: VerificationCodePanelProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-muted/40 p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Verification code detected
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.2em]">{code}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy code"}
          </Button>
          {onViewOriginal ? (
            <Button type="button" variant="outline" onClick={onViewOriginal}>
              <Eye className="h-4 w-4" />
              View message
            </Button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
