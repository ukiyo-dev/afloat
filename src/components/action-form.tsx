"use client";

import { useRef } from "react";

import { isNextRedirectError, showBackendErrorToast } from "@/components/error-toast";

export function ActionForm({ 
  action, 
  children, 
  className,
  id,
  resetOnSuccess = false,
  onSuccess,
  confirmMessage
}: { 
  action: (formData: FormData) => Promise<any>; 
  children: React.ReactNode; 
  className?: string;
  id?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
  confirmMessage?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  
  return (
    <form
      id={id}
      ref={formRef}
      className={className}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      action={async (formData) => {
        try {
          await action(formData);
          if (resetOnSuccess) {
            formRef.current?.reset();
          }
          if (onSuccess) {
            onSuccess();
          }
        } catch (error: unknown) {
          if (isNextRedirectError(error)) {
            throw error;
          }
          showBackendErrorToast(error);
        }
      }}
    >
      {children}
    </form>
  );
}
