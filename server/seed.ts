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
        modelName: "gpt-5.1-codex",
        displayName: "GPT-5.1 Codex",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5.1-codex-max",
        displayName: "GPT-5.1 Codex Max",
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
        modelName: "gpt-5-pro",
        displayName: "GPT-5 Pro",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5-codex",
        displayName: "GPT-5 Codex",
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
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o3-deep-research",
        displayName: "o3 Deep Research",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o4-mini",
        displayName: "o4-mini",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o4-mini-deep-research",
        displayName: "o4-mini Deep Research",
        isActive: true,
      },
      // OpenAI - GPT-4.1 Series
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4.1",
        displayName: "GPT-4.1",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4.1-mini",
        displayName: "GPT-4.1 mini",
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4.1-nano",
        displayName: "GPT-4.1 nano",
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
      // Groq Production Models - Updated from https://console.groq.com/docs/models
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama-3.1-8b-instant",
        displayName: "MetaLlama 3.1 8B",
        tpmLimit: 250000,
        rpmLimit: 1000,
        capabilities: {
          speed: "560 T/sec",
          price: { input: "$0.05/1M", output: "$0.08/1M" },
          contextWindow: 131072,
          maxCompletion: 131072,
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama-3.3-70b-versatile",
        displayName: "MetaLlama 3.3 70B",
        tpmLimit: 300000,
        rpmLimit: 1000,
        capabilities: {
          speed: "280 T/sec",
          price: { input: "$0.59/1M", output: "$0.79/1M" },
          contextWindow: 131072,
          maxCompletion: 32768,
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "meta-llama/llama-guard-4-12b",
        displayName: "MetaLlama Guard 4 12B",
        tpmLimit: 30000,
        rpmLimit: 100,
        capabilities: {
          speed: "1200 T/sec",
          price: { input: "$0.20/1M", output: "$0.20/1M" },
          contextWindow: 131072,
          maxCompletion: 1024,
          maxFileSize: "20 MB",
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "openai/gpt-oss-120b",
        displayName: "OpenAI GPT OSS 120B",
        tpmLimit: 250000,
        rpmLimit: 1000,
        capabilities: {
          speed: "500 T/sec",
          price: { input: "$0.15/1M", output: "$0.60/1M" },
          contextWindow: 131072,
          maxCompletion: 65536,
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "openai/gpt-oss-20b",
        displayName: "OpenAI GPT OSS 20B",
        tpmLimit: 250000,
        rpmLimit: 1000,
        capabilities: {
          speed: "1000 T/sec",
          price: { input: "$0.075/1M", output: "$0.30/1M" },
          contextWindow: 131072,
          maxCompletion: 65536,
        },
        isActive: true,
      },
      // Groq Preview & Latest Models
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "groq/compound",
        displayName: "Groq Compound",
        tpmLimit: 200000,
        rpmLimit: 200,
        capabilities: {
          speed: "450 T/sec",
          contextWindow: 131072,
          maxCompletion: 8192,
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "groq/compound-mini",
        displayName: "Groq Compound Mini",
        tpmLimit: 200000,
        rpmLimit: 200,
        capabilities: {
          speed: "450 T/sec",
          contextWindow: 131072,
          maxCompletion: 8192,
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "meta-llama/llama-4-maverick-17b-128e-instruct",
        displayName: "MetaLlama 4 Maverick 17B 128E",
        tpmLimit: 300000,
        rpmLimit: 1000,
        capabilities: {
          speed: "600 T/sec",
          price: { input: "$0.20/1M", output: "$0.60/1M" },
          contextWindow: 131072,
          maxCompletion: 8192,
          maxFileSize: "20 MB",
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "meta-llama/llama-4-scout-17b-16e-instruct",
        displayName: "MetaLlama 4 Scout 17B 16E",
        tpmLimit: 300000,
        rpmLimit: 1000,
        capabilities: {
          speed: "750 T/sec",
          price: { input: "$0.11/1M", output: "$0.34/1M" },
          contextWindow: 131072,
          maxCompletion: 8192,
          maxFileSize: "20 MB",
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "meta-llama/llama-prompt-guard-2-22m",
        displayName: "MetaLlama Prompt Guard 2 22M",
        tpmLimit: 30000,
        rpmLimit: 100,
        capabilities: {
          price: { input: "$0.03/1M", output: "$0.03/1M" },
          contextWindow: 512,
          maxCompletion: 512,
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "meta-llama/llama-prompt-guard-2-86m",
        displayName: "MetaLlama Prompt Guard 2 86M",
        tpmLimit: 30000,
        rpmLimit: 100,
        capabilities: {
          price: { input: "$0.04/1M", output: "$0.04/1M" },
          contextWindow: 512,
          maxCompletion: 512,
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "moonshotai/kimi-k2-instruct-0905",
        displayName: "Moonshot AI Kimi K2 0905",
        tpmLimit: 250000,
        rpmLimit: 1000,
        capabilities: {
          speed: "200 T/sec",
          price: { input: "$1.00/1M", output: "$3.00/1M" },
          contextWindow: 262144,
          maxCompletion: 16384,
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "openai/gpt-oss-safeguard-20b",
        displayName: "OpenAI Safety GPT OSS 20B",
        tpmLimit: 150000,
        rpmLimit: 1000,
        capabilities: {
          speed: "1000 T/sec",
          price: { input: "$0.075/1M", output: "$0.30/1M" },
          contextWindow: 131072,
          maxCompletion: 65536,
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "qwen/qwen3-32b",
        displayName: "Alibaba Cloud Qwen3-32B",
        tpmLimit: 300000,
        rpmLimit: 1000,
        capabilities: {
          speed: "400 T/sec",
          price: { input: "$0.29/1M", output: "$0.59/1M" },
          contextWindow: 131072,
          maxCompletion: 40960,
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "canopylabs/orpheus-arabic-saudi",
        displayName: "Canopy Labs Orpheus Arabic Saudi",
        tpmLimit: 50000,
        rpmLimit: 250,
        capabilities: {
          price: "$40/1M characters",
          contextWindow: 200,
          maxCompletion: 50000,
        },
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "canopylabs/orpheus-v1-english",
        displayName: "Canopy Labs Orpheus V1 English",
        tpmLimit: 50000,
        rpmLimit: 250,
        capabilities: {
          price: "$22/1M characters",
          contextWindow: 200,
          maxCompletion: 50000,
        },
        isActive: true,
      },
      // Groq Audio Models
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "whisper-large-v3",
        displayName: "OpenAI Whisper Large V3",
        tpmLimit: 200000,
        rpmLimit: 300,
        capabilities: ["audio"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "whisper-large-v3-turbo",
        displayName: "OpenAI Whisper Large V3 Turbo",
        tpmLimit: 400000,
        rpmLimit: 400,
        capabilities: ["audio"],
        isActive: true,
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
