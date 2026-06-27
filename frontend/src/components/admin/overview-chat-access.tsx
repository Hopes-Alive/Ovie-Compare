"use client";

import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink, QrCode, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";

type OverviewChatAccessProps = {
  chatUrl: string;
};

export function OverviewChatAccess({ chatUrl }: OverviewChatAccessProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(chatUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#E5E3DF] bg-white shadow-sm">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[#10B981]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-[#1A1A1A]/5 blur-3xl" />

      <div className="relative p-6 sm:p-8">
        <div className="mb-6 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#ECFDF5]">
            <QrCode className="size-5 text-[#10B981]" />
          </span>
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#1A1A1A]">
              Clinic chat access
            </h2>
            <p className="mt-1 text-[14px] leading-relaxed text-[#A8A39B]">
              Share this QR or link so staff can open Ovie Compare on any device.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-[#10B981]/20 via-transparent to-[#1A1A1A]/10 blur-xl" />
            <div className="relative rounded-[28px] border border-[#E5E3DF] bg-white p-5 shadow-[0_20px_50px_-20px_rgba(16,185,129,0.35)]">
              <QRCodeSVG
                value={chatUrl}
                size={200}
                level="M"
                includeMargin
                fgColor="#1A1A1A"
              />
            </div>
            <div className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[#E5E3DF] bg-white px-3 py-1 text-[11px] font-medium text-[#10B981] shadow-sm">
              <Sparkles className="size-3" />
              Scan to chat
            </div>
          </div>

          <div className="w-full flex-1 space-y-4">
            <div>
              <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[#A8A39B]">
                Chat URL
              </p>
              <p className="break-all rounded-xl border border-[#E5E3DF] bg-[#FAF9F7] px-4 py-3 font-mono text-[13px] text-[#1A1A1A]">
                {chatUrl}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={handleCopy}
                className="h-11 rounded-xl border-[#E5E3DF] bg-white text-[#1A1A1A] hover:bg-[#FAF9F7]"
              >
                {copied ? (
                  <Check data-icon="inline-start" className="text-[#10B981]" />
                ) : (
                  <Copy data-icon="inline-start" />
                )}
                {copied ? "Copied" : "Copy URL"}
              </Button>
              <Button
                className="h-11 rounded-xl bg-[#10B981] text-white shadow-sm transition-colors duration-300 hover:bg-[#059669]"
                render={
                  <a
                    href={ROUTES.chat}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink data-icon="inline-start" />
                Open chat
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
