"use client";

import { QRCodeSVG } from "qrcode.react";

import { ChatUrlActions } from "@/components/landing/chat-url-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type QrCodeCardProps = {
  chatUrl: string;
};

export function QrCodeCard({ chatUrl }: QrCodeCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chat access</CardTitle>
        <CardDescription>
          Scan the QR code or share the link with your clinic team.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="rounded-xl border border-border bg-white p-4">
          <QRCodeSVG value={chatUrl} size={160} level="M" includeMargin />
        </div>
        <div className="w-full flex-1">
          <ChatUrlActions chatUrl={chatUrl} />
        </div>
      </CardContent>
    </Card>
  );
}
