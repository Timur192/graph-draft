import { useEffect, useRef, useState } from "react";
import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";
import type { ChatCompletionMessageParam, WebWorkerMLCEngine } from "@mlc-ai/web-llm";

const selectedModel = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

export const useLLMChatController = () => {
  const [messages, setMessages] = useState<ChatCompletionMessageParam[]>([
    { role: "system", content: "You are a helpful AI assistant." },
  ]);
  const [loading, setLoading] = useState<boolean>(false);
  const engine = useRef<WebWorkerMLCEngine>(null);
  const messagesRef = useRef<ChatCompletionMessageParam[]>(messages);

  console.log(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const startLLM = async () => {
      const initProgressCallback = (initProgress: unknown) => {
        console.log(initProgress);
      };

      engine.current = await CreateWebWorkerMLCEngine(
        new Worker(new URL("../worker.ts", import.meta.url), {
          type: "module",
        }),
        selectedModel,
        { initProgressCallback }, // engineConfig
      );
    };
    startLLM();
  }, []);

  const onMessageSend = async (rawInput: string) => {
    const userInput = rawInput.trim();
    if (!userInput) return;
    if (!engine.current) return;

    setLoading(true);

    const userMessage: ChatCompletionMessageParam = {
      role: "user",
      content: userInput,
    };

    const nextMessages = [...messagesRef.current, userMessage];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);

    try {
      const reply = await engine.current.chat.completions.create({
        messages: nextMessages,
      });

      const assistantMessage = reply.choices?.[0]?.message;
      if (!assistantMessage) return;

      const updatedMessages = [...messagesRef.current, assistantMessage];
      messagesRef.current = updatedMessages;
      setMessages(updatedMessages);
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setLoading(false);
    }
  };

  return { messages, loading, onMessageSend };
};
