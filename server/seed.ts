import { database } from "./storage";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Seed AI Providers
    const providers = [
      {
        name: "openai",
        isActive: true,
        displayName: "OpenAI",
        config: { baseUrl: "https://api.openai.com/v1" },
      },
      {
        name: "groq",
        isActive: true,
        displayName: "Groq",
        config: { baseUrl: "https://api.groq.com/openai/v1" },
      },
      {
        name: "claude",
        isActive: true,
        displayName: "Anthropic Claude",
        config: { baseUrl: "https://api.anthropic.com/v1" },
      },
      {
        name: "huggingface",
        isActive: true,
        displayName: "Hugging Face",
        config: { baseUrl: "https://api-inference.huggingface.co" },
      },
    ];

    console.log("Adding AI providers...");
    const insertedProviders = await database
      .insert(schema.aiProviders)
      .values(providers)
      .onConflictDoUpdate({
        target: schema.aiProviders.name,
        set: { 
          isActive: true, 
          displayName: sql`EXCLUDED.display_name`, 
          config: sql`EXCLUDED.config` 
        },
      })
      .returning();

    console.log(`✅ Added ${insertedProviders.length} AI providers`);

    // Seed AI Models
    const models = [
      // OpenAI - GPT-5 Series
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5.2",
        displayName: "GPT-5.2 (Latest Frontier)",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5.2-pro",
        displayName: "GPT-5.2 Pro",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5.1",
        displayName: "GPT-5.1",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5",
        displayName: "GPT-5",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5-mini",
        displayName: "GPT-5 mini",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5-nano",
        displayName: "GPT-5 nano",
        isActive: true,
      },
      // OpenAI - GPT-4o Series
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4o",
        displayName: "GPT-4o",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4o-mini",
        displayName: "GPT-4o mini",
        isActive: true,
      },
      // OpenAI - o-series
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o1",
        displayName: "o1",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o1-mini",
        displayName: "o1-mini",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o1-pro",
        displayName: "o1-pro",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o3",
        displayName: "o3",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o3-mini",
        displayName: "o3-mini",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o3-pro",
        displayName: "o3-pro",
        isActive: true,
      },
      // OpenAI - Specialized
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "whisper-1",
        displayName: "Whisper-1 (Audio Only)",
        capabilities: ["audio"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "tts-1",
        displayName: "TTS-1",
        capabilities: ["tts"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "tts-1-hd",
        displayName: "TTS-1 HD",
        capabilities: ["tts"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "dall-e-3",
        displayName: "DALL-E 3",
        capabilities: ["image"],
        isActive: true,
      },
      // Groq Production Models
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama-3.1-8b-instant",
        displayName: "LLaMA 3.1 8B Instant",
        isActive: false,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama-3.3-70b-versatile",
        displayName: "LLaMA 3.3 70B Versatile",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "meta-llama/llama-guard-4-12b",
        displayName: "LLaMA Guard 4 12B",
        isActive: false,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "openai/gpt-oss-120b",
        displayName: "GPT OSS 120B",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "openai/gpt-oss-20b",
        displayName: "GPT OSS 20B",
        isActive: true,
      },
      // Groq Preview Models
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "meta-llama/llama-4-maverick-17b-128e-instruct",
        displayName: "Llama 4 Maverick 17B 128E",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "meta-llama/llama-4-scout-17b-16e-instruct",
        displayName: "Llama 4 Scout 17B 16E",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "moonshotai/kimi-k2-instruct-0905",
        displayName: "Kimi K2",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "openai/gpt-oss-safeguard-20b",
        displayName: "Safety GPT OSS 20B",
        isActive: false,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "playai-tts",
        displayName: "PlayAI TTS",
        capabilities: ["tts"],
        isActive: false,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "playai-tts-arabic",
        displayName: "PlayAI TTS Arabic",
        capabilities: ["tts"],
        isActive: false,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "qwen/qwen3-32b",
        displayName: "Qwen 3 32B",
        isActive: true,
      },
      // Groq Legacy Models
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "mixtral-8x7b-32768",
        displayName: "Mixtral 8x7B",
        isActive: false,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "gemma-7b-it",
        displayName: "Gemma 7B",
        isActive: false,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama-3.3-70b-specdec",
        displayName: "LLaMA 3.3 70B SpecDec",
        isActive: false,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama-guard-3-8b",
        displayName: "LLaMA Guard 3 8B",
        isActive: false,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama3-groq-70b-8192-tool-use-preview",
        displayName: "LLaMA 3 Groq 70B Tool Use",
        isActive: false,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama3-groq-8b-8192-tool-use-preview",
        displayName: "LLaMA 3 Groq 8B Tool Use",
        isActive: false,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "whisper-large-v3",
        displayName: "Whisper Large v3",
        capabilities: ["audio"],
        isActive: false,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "whisper-large-v3-turbo",
        displayName: "Whisper Large v3 Turbo",
        capabilities: ["audio"],
        isActive: false,
      },
      // Claude Models
      {
        providerId: insertedProviders.find(p => p.name === "claude")!.id,
        modelName: "claude-3-opus-20240229",
        displayName: "Claude 3 Opus",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "claude")!.id,
        modelName: "claude-3-sonnet-20240229",
        displayName: "Claude 3 Sonnet",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "claude")!.id,
        modelName: "claude-3-haiku-20240307",
        displayName: "Claude 3 Haiku",
        isActive: true,
      },
      // HuggingFace Models
      {
        providerId: insertedProviders.find(p => p.name === "huggingface")!.id,
        modelName: "meta-llama/Llama-2-70b-chat-hf",
        displayName: "LLaMA 2 70B Chat",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "huggingface")!.id,
        modelName: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        displayName: "Mixtral 8x7B Instruct",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "huggingface")!.id,
        modelName: "google/flan-t5-xxl",
        displayName: "FLAN-T5 XXL",
        isActive: true,
      },
    ];

    console.log("Adding AI models...");
    const insertedModels = await database
      .insert(schema.aiModels)
      .values(models)
      .onConflictDoUpdate({
        target: [schema.aiModels.providerId, schema.aiModels.modelName],
        set: { isActive: true, displayName: sql`EXCLUDED.display_name` },
      })
      .returning();

    console.log(`✅ Added ${insertedModels.length} AI models`);

    console.log("✅ Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
