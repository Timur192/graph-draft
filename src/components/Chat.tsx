import React, { useState } from "react";
import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import styles from "./Chat.module.css";

type Props = {
  messages: ChatCompletionMessageParam[];
  loading: boolean;
  onMessageSend: (rawInput: string) => void;
};

export const Chat = ({ messages, loading, onMessageSend }: Props) => {
  const [value, setValue] = useState<string>("");

  const handleSendMessage = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.code === "Enter" && !loading) {
      setValue("");
      onMessageSend(value);
    }
  };

  return (
    <aside className={styles.chatContainer}>
      <header className={styles.chatHeader}>
        <p className={styles.chatKicker}>Assistant</p>
        <p className={loading ? styles.chatStatusBusy : styles.chatStatus}>{loading ? "Thinking..." : "Ready"}</p>
      </header>

      <div className={styles.messageList}>
        {messages
          .filter((msg) => msg.role === "assistant" || msg.role === "user")
          .map((msg, index) => {
            const rowClass = msg.role === "user" ? styles.userRow : styles.assistantRow;
            const messageClass = msg.role === "user" ? styles.userMessage : styles.assistantMessage;

            return (
              <div key={index} className={rowClass}>
                <div className={messageClass}>{`${msg.content}`}</div>
              </div>
            );
          })}
      </div>

      <div className={styles.inputArea}>
        <input
          className={styles.input}
          value={value}
          disabled={loading}
          placeholder={loading ? "Generating response..." : "Write a message and press Enter"}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyUp={handleSendMessage}
        />
      </div>
    </aside>
  );
};
