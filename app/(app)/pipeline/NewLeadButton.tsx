"use client";

import { useState } from "react";
import Icon from "@/components/Icon/Icon";
import type { Commercial } from "@/lib/leads";
import NewLeadModal from "./NewLeadModal";
import styles from "./Pipeline.module.scss";

// Thin client wrapper so the server page can render the trigger button
// without going client itself. Owns the open/close state and mounts the
// modal lazily.

type Props = {
  commerciaux: Commercial[];
  currentUserId: string;
};

export default function NewLeadButton({ commerciaux, currentUserId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.newLeadBtn}
        onClick={() => setOpen(true)}
      >
        <Icon name="check" size={14} /> Nouveau lead
      </button>
      {open && (
        <NewLeadModal
          commerciaux={commerciaux}
          defaultOwnerId={currentUserId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
