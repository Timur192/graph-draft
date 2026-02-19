import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";
import type { WebWorkerMLCEngine } from "@mlc-ai/web-llm";

const DEFAULT_MODEL = "Llama-3.2-3B-Instruct-q4f32_1-MLC";

type EngineOptions = {
  model?: string;
  onInitProgress?: (initProgress: unknown) => void;
};

export const createWorkerEngine = async ({ model = DEFAULT_MODEL, onInitProgress }: EngineOptions = {}): Promise<WebWorkerMLCEngine> =>
  CreateWebWorkerMLCEngine(
    new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    }),
    model,
    { initProgressCallback: onInitProgress },
  );
