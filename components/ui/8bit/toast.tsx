"use client";

import React from "react";

import { toast as sonnerToast } from "sonner";

import "@/components/ui/8bit/styles/retro.css";

export function toast(toast: string) {
  return sonnerToast.custom((id) => <Toast id={id} title={toast} />);
}

interface ToastProps {
  id: string | number;
  title: string;
}

function Toast(props: ToastProps) {
  const { title } = props;

  return (
    <div className="relative">
      <div className="flex w-full items-center rounded-none bg-background p-3 text-sm shadow-lg ring-1 ring-black/5 md:max-w-[364px]">
        <div className="flex flex-1 items-center">
          <div className="w-full">
            <p className="text-sm font-medium">{title}</p>
          </div>
        </div>
      </div>

      <div className="absolute -top-1 left-1 h-1 w-1/2 bg-foreground dark:bg-ring" />
      <div className="absolute -top-1 right-1 h-1 w-1/2 bg-foreground dark:bg-ring" />
      <div className="absolute -bottom-1 left-1 h-1 w-1/2 bg-foreground dark:bg-ring" />
      <div className="absolute -bottom-1 right-1 h-1 w-1/2 bg-foreground dark:bg-ring" />
      <div className="absolute top-0 left-0 size-1 bg-foreground dark:bg-ring" />
      <div className="absolute top-0 right-0 size-1 bg-foreground dark:bg-ring" />
      <div className="absolute bottom-0 left-0 size-1 bg-foreground dark:bg-ring" />
      <div className="absolute right-0 bottom-0 size-1 bg-foreground dark:bg-ring" />
      <div className="absolute top-1 -left-1 h-1/2 w-1 bg-foreground dark:bg-ring" />
      <div className="absolute bottom-1 -left-1 h-1/2 w-1 bg-foreground dark:bg-ring" />
      <div className="absolute top-1 -right-1 h-1/2 w-1 bg-foreground dark:bg-ring" />
      <div className="absolute right-1 bottom-1 h-1/2 w-1 bg-foreground dark:bg-ring" />
    </div>
  );
}
