import { useState, type KeyboardEvent } from "react";
import type { ChatDisplayMessage, ChatEngineStatus } from "../model/types";
import styles from "./Chat.module.css";

type Props = {
  engineStatus: ChatEngineStatus;
  errorMessage: string | null;
  messages: ChatDisplayMessage[];
  loading: boolean;
  onMessageSend: (rawInput: string) => void;
};

export const Chat = ({ engineStatus, errorMessage, messages, loading, onMessageSend }: Props) => {
  const [value, setValue] = useState<string>("");
  const inputDisabled = loading || engineStatus !== "ready";
  const statusText = loading ? "Thinking..." : engineStatus === "ready" ? "Ready" : engineStatus === "loading" ? "Loading model..." : "Unavailable";

  const handleSendMessage = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.code === "Enter" && !inputDisabled) {
      setValue("");
      onMessageSend(value);
    }
  };

  return (
    <aside className={styles.chatContainer}>
      <header className={styles.chatHeader}>
        <p className={styles.chatKicker}>Assistant</p>
        <p className={loading ? styles.chatStatusBusy : styles.chatStatus}>{statusText}</p>
      </header>

      <div className={styles.messageList}>
        {errorMessage ? <div className={styles.assistantMessage}>{errorMessage}</div> : null}
        {messages.map((msg, index) => {
          const rowClass = msg.role === "user" ? styles.userRow : styles.assistantRow;
          const messageClass = msg.role === "user" ? styles.userMessage : styles.assistantMessage;

          return (
            <div key={index} className={rowClass}>
              <div className={messageClass}>{msg.content}</div>
            </div>
          );
        })}
      </div>

      <div className={styles.inputArea}>
        <input
          className={styles.input}
          value={value}
          disabled={inputDisabled}
          placeholder={loading ? "Generating response..." : engineStatus === "ready" ? "Write a message and press Enter" : "Model is not ready yet"}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyUp={handleSendMessage}
        />
      </div>
    </aside>
  );
};
