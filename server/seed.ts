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
      // OpenAI - GPT-5 Series (Latest)
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5.1",
        displayName: "GPT-5.1 (الأفضل للبرمجة وتحديات الكود)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5",
        displayName: "GPT-5 (نموذج التفكير المتقدم)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5-mini",
        displayName: "GPT-5 mini (سريع وفعال)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5-nano",
        displayName: "GPT-5 nano (الأسرع)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5-pro",
        displayName: "GPT-5 Pro (الأذكى والأدق)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5.1-codex",
        displayName: "GPT-5.1 Codex (متخصص البرمجة)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-5.1-codex-max",
        displayName: "GPT-5.1 Codex Max (أقوى لمهام البرمجة)",
        capabilities: ["text"],
        isActive: true,
      },
      // OpenAI - GPT-4 Series
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4.1",
        displayName: "GPT-4.1 (الأذكى بدون تفكير معمق)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4.1-mini",
        displayName: "GPT-4.1 mini",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4.1-nano",
        displayName: "GPT-4.1 nano (الأسرع)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4-turbo",
        displayName: "GPT-4 Turbo (الإصدار الأخير)",
        capabilities: ["text"],
        isActive: true,
      },
      // OpenAI - o-series (Reasoning Models)
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o3",
        displayName: "o3 (نموذج التفكير العميق)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o3-pro",
        displayName: "o3 Pro (نموذج التفكير مع حساب إضافي)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o3-mini",
        displayName: "o3 mini (نموذج التفكير الخفيف)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o3-deep-research",
        displayName: "o3 Deep Research (بحث عميق)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o4-mini",
        displayName: "o4 mini (نموذج التفكير السريع)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "o4-mini-deep-research",
        displayName: "o4 mini Deep Research",
        capabilities: ["text"],
        isActive: true,
      },
      // OpenAI - Audio & Multimodal
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-audio",
        displayName: "GPT Audio (مدخلات ومخرجات صوتية)",
        capabilities: ["audio"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-realtime",
        displayName: "GPT Realtime (وقت فعلي)",
        capabilities: ["audio"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-realtime-mini",
        displayName: "GPT Realtime mini",
        capabilities: ["audio"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-audio-mini",
        displayName: "GPT Audio mini",
        capabilities: ["audio"],
        isActive: true,
      },
      // OpenAI - Vision/Image
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-image-1",
        displayName: "GPT Image 1 (توليد الصور)",
        capabilities: ["image"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-image-1-mini",
        displayName: "GPT Image 1 mini",
        capabilities: ["image"],
        isActive: true,
      },
      // OpenAI - Video
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "sora-2",
        displayName: "Sora 2 (توليد الفيديو مع الصوت)",
        capabilities: ["video"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "sora-2-pro",
        displayName: "Sora 2 Pro (الأفضل لتوليد الفيديو)",
        capabilities: ["video"],
        isActive: true,
      },
      // OpenAI - Specialized
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "omni-moderation",
        displayName: "Omni Moderation (فلترة المحتوى)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4o-mini-tts",
        displayName: "GPT-4o mini TTS (تحويل نص لصوت)",
        capabilities: ["audio"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4o-transcribe",
        displayName: "GPT-4o Transcribe (تحويل صوت لنص)",
        capabilities: ["audio"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4o-mini-transcribe",
        displayName: "GPT-4o mini Transcribe",
        capabilities: ["audio"],
        isActive: true,
      },
      // OpenAI - Search Models
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4o-search-preview",
        displayName: "GPT-4o Search (البحث على الويب)",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "openai")!.id,
        modelName: "gpt-4o-mini-search-preview",
        displayName: "GPT-4o mini Search",
        capabilities: ["text"],
        isActive: true,
      },
      // Groq Production Models
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama-3.1-8b-instant",
        displayName: "LLaMA 3.1 8B Instant",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama-3.3-70b-versatile",
        displayName: "LLaMA 3.3 70B Versatile",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "meta-llama/llama-guard-4-12b",
        displayName: "LLaMA Guard 4 12B",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "openai/gpt-oss-120b",
        displayName: "GPT OSS 120B",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "openai/gpt-oss-20b",
        displayName: "GPT OSS 20B",
        capabilities: ["text"],
        isActive: true,
      },
      // Groq Preview Models
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "meta-llama/llama-4-maverick-17b-128e-instruct",
        displayName: "Llama 4 Maverick 17B 128E",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "meta-llama/llama-4-scout-17b-16e-instruct",
        displayName: "Llama 4 Scout 17B 16E",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "moonshotai/kimi-k2-instruct-0905",
        displayName: "Kimi K2",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "openai/gpt-oss-safeguard-20b",
        displayName: "Safety GPT OSS 20B",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "playai-tts",
        displayName: "PlayAI TTS",
        capabilities: ["tts"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "playai-tts-arabic",
        displayName: "PlayAI TTS Arabic",
        capabilities: ["tts"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "qwen/qwen3-32b",
        displayName: "Qwen 3 32B",
        capabilities: ["text"],
        isActive: true,
      },
      // Groq Legacy Models
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "mixtral-8x7b-32768",
        displayName: "Mixtral 8x7B",
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
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama-3.3-70b-specdec",
        displayName: "LLaMA 3.3 70B SpecDec",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama-guard-3-8b",
        displayName: "LLaMA Guard 3 8B",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama3-groq-70b-8192-tool-use-preview",
        displayName: "LLaMA 3 Groq 70B Tool Use",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "llama3-groq-8b-8192-tool-use-preview",
        displayName: "LLaMA 3 Groq 8B Tool Use",
        capabilities: ["text"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "whisper-large-v3",
        displayName: "Whisper Large v3",
        capabilities: ["audio"],
        isActive: true,
      },
      {
        providerId: insertedProviders.find(p => p.name === "groq")!.id,
        modelName: "whisper-large-v3-turbo",
        displayName: "Whisper Large v3 Turbo",
        capabilities: ["audio"],
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
