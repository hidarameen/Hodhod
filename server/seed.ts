import { database } from "./storage";
import * as schema from "@shared/schema";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Seed AI Providers
    const providers = [
      {
        name: "openai",
        isActive: true,
        config: { baseUrl: "https://api.openai.com/v1" },
      },
      {
        name: "groq",
        isActive: true,
        config: { baseUrl: "https://api.groq.com/openai/v1" },
      },
      {
        name: "claude",
        isActive: true,
        config: { baseUrl: "https://api.anthropic.com/v1" },
      },
      {
        name: "huggingface",
        isActive: true,
        config: { baseUrl: "https://api-inference.huggingface.co" },
      },
    ];

    console.log("Adding AI providers...");
    const insertedProviders = await database
      .insert(schema.aiProviders)
      .values(providers)
      .onConflictDoUpdate({
        target: schema.aiProviders.name,
        set: { isActive: true },
      })
      .returning();

    console.log(`✅ Added ${insertedProviders.length} AI providers`);

    // Seed AI Models
    const models = [
      // OpenAI Models
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4-turbo-preview",
        displayName: "GPT-4 Turbo",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4",
        displayName: "GPT-4",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-3.5-turbo",
        displayName: "GPT-3.5 Turbo",
        capabilities: ["text"],
        isActive: true,
      },
      // Groq Models
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "mixtral-8x7b-32768",
        displayName: "Mixtral 8x7B",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama2-70b-4096",
        displayName: "LLaMA 2 70B",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "gemma-7b-it",
        displayName: "Gemma 7B",
        capabilities: ["text"],
        isActive: true,
      },
      // Claude Models
      {
        providerId: insertedProviders.find(p => p.name === "claude")!.id,
        modelName: "claude-3-opus-20240229",
        displayName: "Claude 3 Opus",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "claude")!.id,
        modelName: "claude-3-sonnet-20240229",
        displayName: "Claude 3 Sonnet",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "claude")!.id,
        modelName: "claude-3-haiku-20240307",
        displayName: "Claude 3 Haiku",
        capabilities: ["text"],
        isActive: true,
      },
      // HuggingFace Models
      {
        providerId: insertedProviders.find(p => p.name === "huggingface")!.id,
        modelName: "meta-llama/Llama-2-70b-chat-hf",
        displayName: "LLaMA 2 70B Chat",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "huggingface")!.id,
        modelName: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        displayName: "Mixtral 8x7B Instruct",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "huggingface")!.id,
        modelName: "google/flan-t5-xxl",
        displayName: "FLAN-T5 XXL",
        capabilities: ["text"],
        isActive: true,
      },
    ];

    console.log("Adding AI models...");
    const insertedModels = await database
      .insert(schema.aiModels)
      .values(models)
      .onConflictDoNothing()
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
