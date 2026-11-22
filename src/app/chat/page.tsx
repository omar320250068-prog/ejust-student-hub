import type { Metadata } from "next";
import ChatClient from "@/components/chat/ChatClient";

export const metadata: Metadata = {
  title: "Campus Chat · E-JUST Student Hub",
  description: "Campus and course channels for E-JUST students.",
};

export default function ChatPage() {
  return <ChatClient />;
}
