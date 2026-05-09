"use client";

import { useRef } from "react";

import { isNextRedirectError, showBackendErrorToast } from "@/components/error-toast";

export function ActionForm({ 
  action, 
  children, 
  className,
  resetOnSuccess = false,
  onSuccess
}: { 
  action: (formData: FormData) => Promise<any>; 
  children: React.ReactNode; 
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  
  return (
    <form
      ref={formRef}
      className={className}
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
